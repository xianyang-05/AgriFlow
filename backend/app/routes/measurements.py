from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.measurement_session import MeasurementSession
from app.schemas.measurement import (
    MeasurementCreateRequest,
    MeasurementPayload,
    MeasurementPollResponse,
    MeasurementWriteResponse,
)

router = APIRouter(prefix="/measurements", tags=["measurements"])


def ensure_measurements_table(db: Session) -> None:
    MeasurementSession.__table__.create(bind=db.get_bind(), checkfirst=True)


@router.post("", response_model=MeasurementWriteResponse)
async def create_measurement(
    payload: MeasurementCreateRequest,
    db: Session = Depends(get_db),
) -> MeasurementWriteResponse:
    ensure_measurements_table(db)

    measurement = db.get(MeasurementSession, payload.session_id)
    if measurement is None:
        measurement = MeasurementSession(session_id=payload.session_id)
        db.add(measurement)

    measurement.plant_id = payload.plant_id
    measurement.height_cm = float(payload.height_cm)
    measurement.consumed_at = None

    db.commit()

    return MeasurementWriteResponse(success=True, message="Measurement saved.")


@router.get("/{session_id}", response_model=MeasurementPollResponse)
async def get_measurement(
    session_id: str,
    db: Session = Depends(get_db),
):
    ensure_measurements_table(db)

    measurement = db.get(MeasurementSession, session_id)

    if measurement is None or measurement.consumed_at is not None:
        return JSONResponse(
            status_code=202,
            content=MeasurementPollResponse(success=False, message="Waiting for data...").model_dump(mode="json"),
        )

    measurement.consumed_at = datetime.now(timezone.utc)
    db.commit()

    payload = MeasurementPayload(
        session_id=measurement.session_id,
        plant_id=measurement.plant_id,
        height_cm=measurement.height_cm,
        timestamp=measurement.created_at,
    )
    return MeasurementPollResponse(success=True, data=payload)
