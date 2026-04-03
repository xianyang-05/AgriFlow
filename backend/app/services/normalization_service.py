import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.exceptions import LLMError, NormalizationError
from app.schemas.input import NormalizedFarmInput, RawInput
from app.services.llm_service import LLMService
from app.unit_conversion import ConversionError, convert_area, convert_budget


class _NormalizationExtraction(BaseModel):
    area_text: str | None = None
    budget_text: str | None = None
    location_text: str | None = None
    target_month: int | None = None
    forecast_horizon_months: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    soil_type: str | None = None


class NormalizationService:
    def __init__(self, llm_service: LLMService | None = None) -> None:
        self.settings = get_settings()
        self.llm_service = llm_service or LLMService()

    def normalize(self, raw_input: RawInput, prompt_notes: str | None = None) -> tuple[NormalizedFarmInput, list[str]]:
        warnings: list[str] = []
        extracted: _NormalizationExtraction
        try:
            llm_payload = self.llm_service.extract_normalization(raw_input, prompt_notes=prompt_notes)
            extracted = _NormalizationExtraction.model_validate(llm_payload)
        except (LLMError, ValidationError):
            extracted = _NormalizationExtraction(
                area_text=raw_input.area_text,
                budget_text=raw_input.budget_text,
                location_text=raw_input.location_text,
                soil_type=raw_input.soil_type_text,
            )

        try:
            normalized = self._convert_extracted(extracted)
        except ConversionError:
            normalized = self._fallback_parse(raw_input)

        if normalized.location_text is None:
            normalized.location_text = extracted.location_text or raw_input.location_text

        if normalized.target_month is None:
            normalized.target_month = datetime.now().month
            warnings.append(
                f"Planting month assumed to be {normalized.target_month}. Confirm or update via chat."
            )

        if normalized.forecast_horizon_months is None:
            normalized.forecast_horizon_months = self.settings.default_forecast_horizon_months
            warnings.append(
                f"Forecast horizon defaulted to {self.settings.default_forecast_horizon_months} months."
            )

        normalized.extraction_confidence = self._calculate_confidence(normalized)
        if normalized.extraction_confidence < 0.6:
            normalized.clarification_needed = True
            if normalized.area_m2 is None:
                normalized.clarification_questions.append("Please clarify your farm area.")
            if normalized.budget_myr is None:
                normalized.clarification_questions.append("Please clarify your budget.")
            if normalized.latitude is None or normalized.longitude is None:
                normalized.clarification_questions.append(
                    "Please clarify your farm coordinates if available."
                )

        if normalized.area_m2 is None or normalized.budget_myr is None:
            raise NormalizationError("Required inputs could not be normalized")

        return normalized, warnings

    def _convert_extracted(self, extracted: _NormalizationExtraction) -> NormalizedFarmInput:
        return NormalizedFarmInput(
            area_m2=convert_area(extracted.area_text) if extracted.area_text else None,
            budget_myr=convert_budget(extracted.budget_text) if extracted.budget_text else None,
            latitude=extracted.latitude,
            longitude=extracted.longitude,
            target_month=extracted.target_month,
            forecast_horizon_months=extracted.forecast_horizon_months,
            location_text=extracted.location_text,
            soil_type=self._normalize_soil_type(extracted.soil_type),
        )

    def _fallback_parse(self, raw_input: RawInput) -> NormalizedFarmInput:
        latitude, longitude = self._extract_coordinates(raw_input.location_text or "")
        return NormalizedFarmInput(
            area_m2=self._safe_convert(convert_area, raw_input.area_text),
            budget_myr=self._safe_convert(convert_budget, raw_input.budget_text),
            latitude=latitude,
            longitude=longitude,
            target_month=self._extract_int(raw_input.notes),
            location_text=raw_input.location_text,
            soil_type=self._normalize_soil_type(raw_input.soil_type_text),
        )

    def _extract_coordinates(self, text: str) -> tuple[float | None, float | None]:
        match = re.search(r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)", text)
        if not match:
            return None, None
        return float(match.group(1)), float(match.group(2))

    def _extract_int(self, text: str | None) -> int | None:
        if not text:
            return None
        match = re.search(r"\b(1[0-2]|[1-9])\b", text)
        if not match:
            return None
        return int(match.group(1))

    def _safe_convert(self, converter: Any, value: str | None) -> float | None:
        if not value:
            return None
        try:
            return float(converter(value))
        except ConversionError:
            return None

    def _normalize_soil_type(self, value: str | None) -> str | None:
        if not value:
            return None
        normalized = value.strip().lower()
        if normalized in {"loamy", "clay", "sandy", "silt", "peat", "chalky"}:
            return normalized
        return None

    def _calculate_confidence(self, normalized: NormalizedFarmInput) -> float:
        required_fields = [
            normalized.area_m2,
            normalized.budget_myr,
            normalized.latitude,
            normalized.longitude,
        ]
        extracted_count = sum(1 for value in required_fields if value is not None)
        return extracted_count / len(required_fields)
