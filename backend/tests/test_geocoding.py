import httpx
import pytest

from app.exceptions import GeocodingError
from app.services.geocoding_service import GeocodingService


class DummyResponse:
    def __init__(self, payload, should_raise: bool = False):
        self._payload = payload
        self._should_raise = should_raise

    def raise_for_status(self):
        if self._should_raise:
            raise httpx.HTTPStatusError("boom", request=None, response=None)

    def json(self):
        return self._payload


class SuccessClient:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def get(self, *args, **kwargs):
        return DummyResponse(self.payload)


def test_geocoding_success(monkeypatch):
    monkeypatch.setattr(
        "app.services.geocoding_service.httpx.Client",
        lambda timeout: SuccessClient([{"lat": "5.9", "lon": "100.4", "display_name": "Penang"}]),
    )
    service = GeocodingService()
    result = service.geocode("Penang")

    assert result.latitude == 5.9
    assert result.longitude == 100.4


def test_geocoding_not_found(monkeypatch):
    monkeypatch.setattr(
        "app.services.geocoding_service.httpx.Client",
        lambda timeout: SuccessClient([]),
    )
    service = GeocodingService()

    with pytest.raises(GeocodingError):
        service.geocode("Unknown place")


def test_geocoding_timeout(monkeypatch):
    class TimeoutClient(SuccessClient):
        def get(self, *args, **kwargs):
            raise httpx.TimeoutException("timeout")

    monkeypatch.setattr(
        "app.services.geocoding_service.httpx.Client",
        lambda timeout: TimeoutClient([]),
    )
    service = GeocodingService()

    with pytest.raises(GeocodingError):
        service.geocode("Penang")
