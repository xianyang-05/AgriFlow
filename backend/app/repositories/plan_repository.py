from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.plan_version import PlanVersion


class PlanRepository:
    def get_current(self, db: Session, run_id: str) -> PlanVersion | None:
        statement = (
            select(PlanVersion)
            .where(PlanVersion.run_id == run_id)
            .order_by(desc(PlanVersion.version_number))
            .limit(1)
        )
        return db.scalar(statement)

    def get_by_version(self, db: Session, run_id: str, version_number: int) -> PlanVersion | None:
        statement = select(PlanVersion).where(
            PlanVersion.run_id == run_id,
            PlanVersion.version_number == version_number,
        )
        return db.scalar(statement)

    def get_previous(self, db: Session, run_id: str, version_number: int) -> PlanVersion | None:
        statement = (
            select(PlanVersion)
            .where(
                PlanVersion.run_id == run_id,
                PlanVersion.version_number < version_number,
            )
            .order_by(desc(PlanVersion.version_number))
            .limit(1)
        )
        return db.scalar(statement)

    def has_previous_version(self, db: Session, run_id: str) -> bool:
        count = db.scalar(select(func.count()).select_from(PlanVersion).where(PlanVersion.run_id == run_id))
        return bool(count and count > 1)

    def next_version_number(self, db: Session, run_id: str) -> int:
        current_max = db.scalar(
            select(func.max(PlanVersion.version_number)).where(PlanVersion.run_id == run_id)
        )
        return (current_max or 0) + 1

    def save(self, db: Session, **payload: object) -> PlanVersion:
        version = PlanVersion(**payload)
        db.add(version)
        db.commit()
        db.refresh(version)
        return version
