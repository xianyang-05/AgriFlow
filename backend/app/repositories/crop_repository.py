from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.crop import Crop
from app.schemas.crop import CropRecord


class CropRepository:
    def list_crops(self, db: Session, enabled: bool | None = True) -> list[Crop]:
        statement = select(Crop)
        if enabled is not None:
            statement = statement.where(Crop.enabled.is_(enabled))
        return list(db.scalars(statement.order_by(Crop.name)).all())

    def upsert_crops(self, db: Session, crops: list[CropRecord]) -> None:
        for crop in crops:
            db.merge(Crop(**crop.model_dump()))
        db.commit()
