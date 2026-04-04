from datetime import datetime

from pydantic import BaseModel, Field


class MeasurementCreateRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    plant_id: str | None = Field(default=None, max_length=100)
    height_cm: float


class MeasurementPayload(BaseModel):
    session_id: str
    plant_id: str | None = None
    height_cm: float
    timestamp: datetime


class MeasurementPollResponse(BaseModel):
    success: bool
    data: MeasurementPayload | None = None
    message: str | None = None


class MeasurementWriteResponse(BaseModel):
    success: bool
    message: str
