from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.crop_repository import CropRepository
from app.schemas.crop import CropRecord

router = APIRouter(prefix="/crops", tags=["crops"])
crop_repository = CropRepository()


@router.get("", response_model=list[CropRecord])
def list_crops(
    enabled: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[CropRecord]:
    return [CropRecord.model_validate(crop) for crop in crop_repository.list_crops(db, enabled=enabled)]
