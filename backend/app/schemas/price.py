from typing import Literal

from pydantic import BaseModel


class PriceResult(BaseModel):
    crop_id: str
    current_price: float = 0.0
    predicted_price: float
    pct_change: float = 0.0
    trend: Literal["UP", "STABLE", "DOWN"] = "STABLE"
    confidence: str = "LOW"
    method: str = "baseline_fallback"
