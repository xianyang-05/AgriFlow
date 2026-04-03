from typing import Literal

from pydantic import BaseModel


class PriceResult(BaseModel):
    crop_id: str
    predicted_price: float
    confidence: Literal["LOW"] = "LOW"
    method: Literal["placeholder"] = "placeholder"
