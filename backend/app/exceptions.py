from dataclasses import dataclass, field


@dataclass
class DomainError(Exception):
    message: str = "Request failed"
    http_status: int = 200
    status: str = "incomplete"
    clarification_needed: bool = False
    clarification_questions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_response(self) -> dict[str, object]:
        return {
            "status": self.status,
            "clarification_needed": self.clarification_needed,
            "clarification_questions": self.clarification_questions,
            "warnings": self.warnings,
            "message": self.message,
        }


class GeocodingError(DomainError):
    def __init__(self, message: str = "Unable to geocode farm location") -> None:
        super().__init__(
            message=message,
            status="incomplete",
            clarification_needed=True,
            clarification_questions=[
                "Please clarify your farm location (district, state, or nearby landmark)"
            ],
        )


class AltitudeError(DomainError):
    def __init__(self, message: str = "Unable to determine altitude") -> None:
        super().__init__(
            message=message,
            status="incomplete",
            warnings=["Altitude unavailable - climate estimates may be less precise"],
        )


class ClimateError(DomainError):
    def __init__(self, message: str = "Climate model unavailable") -> None:
        super().__init__(
            message=message,
            status="incomplete",
            warnings=["Climate model unavailable - try again shortly"],
        )


class NormalizationError(DomainError):
    def __init__(self, message: str = "Unable to normalize farm input") -> None:
        super().__init__(
            message=message,
            status="incomplete",
            clarification_needed=True,
            clarification_questions=["Please clarify your area, budget, or location details."],
        )


class NoViableCropsError(DomainError):
    def __init__(self, message: str = "No crops passed hard constraints") -> None:
        super().__init__(
            message=message,
            status="no_viable_crops",
            warnings=[
                "No crops passed hard constraints. Consider adjusting budget, location, or planting month via chat."
            ],
        )


class LLMError(DomainError):
    def __init__(self, message: str = "LLM request failed") -> None:
        super().__init__(message=message)


class RunNotFoundError(DomainError):
    def __init__(self, message: str = "Recommendation run not found") -> None:
        super().__init__(message=message, http_status=404)


class UnsupportedPersistenceModeError(DomainError):
    def __init__(self, message: str = "This endpoint is unavailable when local persistence mode is enabled.") -> None:
        super().__init__(message=message, http_status=503)
