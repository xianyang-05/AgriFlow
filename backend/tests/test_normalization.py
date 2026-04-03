from app.schemas.input import RawInput
from app.services.llm_service import LLMService
from app.services.normalization_service import NormalizationService


class SparseLLMService(LLMService):
    def extract_normalization(self, raw_input, prompt_notes=None):
        return {
            "area_text": raw_input.area_text,
            "budget_text": raw_input.budget_text,
            "location_text": raw_input.location_text,
            "target_month": None,
            "forecast_horizon_months": None,
            "latitude": None,
            "longitude": None,
            "soil_type": raw_input.soil_type_text,
        }


def test_normalization_converts_football_fields_and_budget(test_services):
    service = test_services["recommendation"].normalization_service
    normalized, warnings = service.normalize(
        RawInput(
            area_text="2 football fields",
            budget_text="8k",
            location_text="5.9, 100.4",
            soil_type_text="Loamy",
        )
    )

    assert round(normalized.area_m2, 1) == 14280.0
    assert normalized.budget_myr == 8000.0
    assert normalized.extraction_confidence == 1.0
    assert normalized.soil_type == "loamy"
    assert warnings == []


def test_normalization_marks_ambiguous_inputs_low_confidence():
    service = NormalizationService(llm_service=SparseLLMService())
    normalized, warnings = service.normalize(
        RawInput(
            area_text="1 acre",
            budget_text="2000",
            location_text="near the old bridge",
        )
    )

    assert normalized.extraction_confidence < 0.6
    assert normalized.clarification_needed is True
    assert any("coordinates" in question.lower() for question in normalized.clarification_questions)
    assert len(warnings) == 2
