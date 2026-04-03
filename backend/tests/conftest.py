import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.adapters.climate_model_adapter import ClimateModelAdapter
from app.database import Base, get_db
from app.main import app
from app.repositories.chat_repository import ChatRepository
from app.repositories.crop_repository import CropRepository
from app.repositories.plan_repository import PlanRepository
from app.repositories.run_repository import RunRepository
from app.routes import health
from app.routes.chat import chat_service
from app.routes.recommendations import recommendation_service
from app.schemas.chat import IntentClassification
from app.schemas.climate import ClimateOutput, ClimateRequest
from app.schemas.input import GeocodeResult
from app.seed.crops import SEED_CROPS
from app.services.chat_service import ChatService
from app.services.climate_service import ClimateService
from app.services.decision_service import DecisionService
from app.services.explanation_service import ExplanationService
from app.services.hard_constraint_service import HardConstraintService
from app.services.normalization_service import NormalizationService
from app.services.plan_history_service import PlanHistoryService
from app.services.price_service import PriceService
from app.services.recommendation_service import RecommendationService
from app.services.suitability_service import SuitabilityService


class MockLLMService:
    def __init__(self) -> None:
        self.last_history = None
        self.intent_response = IntentClassification(intent="question", confidence=0.9)

    def extract_normalization(self, raw_input, prompt_notes=None):
        lat = lon = None
        if raw_input.location_text:
            match = re.search(r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)", raw_input.location_text)
            if match:
                lat = float(match.group(1))
                lon = float(match.group(2))
        return {
            "area_text": raw_input.area_text,
            "budget_text": raw_input.budget_text,
            "location_text": raw_input.location_text,
            "target_month": 4,
            "forecast_horizon_months": 3,
            "latitude": lat,
            "longitude": lon,
            "soil_type": raw_input.soil_type_text,
        }

    def classify_intent(self, message, history, context):
        self.last_history = history
        return self.intent_response

    def answer_question(self, message, history, context):
        self.last_history = history
        return "Question answered"

    def generate_explanation(self, explanation_input):
        return "LLM explanation"

    def check_health(self):
        return {"status": "healthy"}


class MockGeocodingService:
    def geocode(self, location_text: str) -> GeocodeResult:
        return GeocodeResult(latitude=5.9, longitude=100.4, display_name=location_text, confidence=0.95)

    def check_health(self):
        return {"status": "configured"}


class MockAltitudeService:
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail

    def get_altitude(self, latitude: float, longitude: float) -> float:
        if self.should_fail:
            from app.exceptions import AltitudeError

            raise AltitudeError()
        return 12.0

    def check_health(self):
        return {"status": "configured"}


class StubClimateAdapter:
    def __init__(self, climate_output: ClimateOutput) -> None:
        self._climate_output = climate_output

    def fetch(self, request: ClimateRequest) -> ClimateOutput:
        return self._climate_output

    def check_health(self):
        return {"status": "configured"}


@pytest.fixture
def climate_payload() -> dict:
    fixture_path = Path(__file__).parent / "fixtures" / "climate_stub.json"
    return json.loads(fixture_path.read_text())


@pytest.fixture
def climate_output(climate_payload) -> ClimateOutput:
    adapter = ClimateModelAdapter()
    return adapter.parse(
        climate_payload,
        ClimateRequest(lat=5.9, lon=100.4, target_month=4, horizon_months=3),
    )


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(engine)

    with TestingSessionLocal() as session:
        CropRepository().upsert_crops(session, SEED_CROPS)
        yield session

    Base.metadata.drop_all(engine)


@pytest.fixture
def test_services(db_session, climate_output, monkeypatch):
    llm = MockLLMService()
    climate_service = ClimateService(adapter=StubClimateAdapter(climate_output))
    recommendation = RecommendationService(
        normalization_service=NormalizationService(llm_service=llm),
        geocoding_service=MockGeocodingService(),
        altitude_service=MockAltitudeService(),
        climate_service=climate_service,
        suitability_service=SuitabilityService(climate_service),
        hard_constraint_service=HardConstraintService(),
        decision_service=DecisionService(climate_service, PriceService()),
        explanation_service=ExplanationService(llm_service=llm),
        crop_repository=CropRepository(),
        run_repository=RunRepository(),
        plan_history_service=PlanHistoryService(PlanRepository()),
    )
    chat = ChatService(
        llm_service=llm,
        chat_repository=ChatRepository(),
        recommendation_service=recommendation,
        plan_history_service=recommendation.plan_history_service,
    )

    monkeypatch.setattr("app.routes.recommendations.recommendation_service", recommendation)
    monkeypatch.setattr("app.routes.chat.chat_service", chat)
    monkeypatch.setattr(health, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(health.LLMService, "check_health", lambda self: {"status": "healthy"})
    monkeypatch.setattr(health.GeocodingService, "check_health", lambda self: {"status": "configured"})
    monkeypatch.setattr(health.AltitudeService, "check_health", lambda self: {"status": "configured"})
    monkeypatch.setattr(health.ClimateModelAdapter, "check_health", lambda self: {"status": "configured"})

    return {"llm": llm, "recommendation": recommendation, "chat": chat}


@pytest.fixture
def client(db_session, test_services):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
