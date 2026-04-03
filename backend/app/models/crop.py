from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, json_type


class Crop(Base):
    __tablename__ = "crops"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    growth_days: Mapped[int] = mapped_column(Integer, nullable=False)
    min_rainfall_mm: Mapped[float] = mapped_column(Float, nullable=False)
    max_rainfall_mm: Mapped[float] = mapped_column(Float, nullable=False)
    min_temp_c: Mapped[float] = mapped_column(Float, nullable=False)
    max_temp_c: Mapped[float] = mapped_column(Float, nullable=False)
    planting_months: Mapped[list[int]] = mapped_column(json_type, nullable=False)
    min_budget_per_m2: Mapped[float] = mapped_column(Float, nullable=False)
    drought_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    flood_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
