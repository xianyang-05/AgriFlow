from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.recommendation_run import RecommendationRun
from app.schemas.input import RawInput


class RunRepository:
    def create(self, db: Session, raw_input: RawInput) -> RecommendationRun:
        run = RecommendationRun(raw_input=raw_input.model_dump())
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    def get(self, db: Session, run_id: str) -> RecommendationRun | None:
        return db.scalar(select(RecommendationRun).where(RecommendationRun.id == run_id))
