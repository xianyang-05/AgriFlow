from app.schemas.crop import CropRecord
from app.schemas.price import PriceResult


STATIC_BASELINE = {
    "maize": 5.0,
    "chili": 11.0,
    "okra": 7.0,
    "eggplant": 8.0,
    "cucumber": 7.5,
    "spinach": 6.0,
    "kangkung": 5.5,
    "long_bean": 7.8,
}


class PriceService:
    def get_price(self, crop: CropRecord) -> PriceResult:
        return PriceResult(crop_id=crop.id, predicted_price=STATIC_BASELINE[crop.id])

    def build_rank_scores(self, crops: list[CropRecord]) -> dict[str, float]:
        ordered = sorted(crops, key=lambda crop: STATIC_BASELINE[crop.id])
        if len(ordered) == 1:
            return {ordered[0].id: 1.0}
        return {crop.id: index / (len(ordered) - 1) for index, crop in enumerate(ordered)}
