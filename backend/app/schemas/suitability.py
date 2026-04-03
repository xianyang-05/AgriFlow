from pydantic import BaseModel


class SuitabilityResult(BaseModel):
    crop_id: str
    suitable: bool
    marginal: bool = False
    reason: str


class EliminationReason(BaseModel):
    crop_id: str
    reason: str
