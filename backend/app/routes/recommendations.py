from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.input import RawInput
from app.schemas.plan import RecommendationResponse
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/recommendations", tags=["recommendations"])
recommendation_service = RecommendationService()


@router.post("", response_model=RecommendationResponse)
def create_recommendation(
    payload: RawInput,
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    return recommendation_service.create_recommendation(db, payload)


@router.get("/{run_id}", response_model=RecommendationResponse)
def get_recommendation(
    run_id: str,
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    return recommendation_service.get_current(db, run_id)


@router.post("/{run_id}/revert", response_model=RecommendationResponse)
def revert_recommendation(
    run_id: str,
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    return recommendation_service.revert(db, run_id)
