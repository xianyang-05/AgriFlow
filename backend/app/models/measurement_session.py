from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MeasurementSession(Base):
    __tablename__ = "measurement_sessions"

    session_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    plant_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    height_cm: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
