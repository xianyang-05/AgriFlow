from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, json_type


class PlanVersion(Base):
    __tablename__ = "plan_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("recommendation_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    normalized_input: Mapped[dict] = mapped_column(json_type, nullable=False)
    user_preferences: Mapped[dict] = mapped_column(json_type, nullable=False)
    climate_output: Mapped[dict | None] = mapped_column(json_type, nullable=True)
    eliminated_crops: Mapped[list] = mapped_column(json_type, nullable=False, default=list)
    ranked_crops: Mapped[list] = mapped_column(json_type, nullable=False, default=list)
    aggressive_plan: Mapped[dict | None] = mapped_column(json_type, nullable=True)
    conservative_plan: Mapped[dict | None] = mapped_column(json_type, nullable=True)
    explanation: Mapped[str] = mapped_column(String, nullable=False, default="")
    warnings: Mapped[list] = mapped_column(json_type, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    version_note: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
