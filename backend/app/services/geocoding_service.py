import httpx

from app.config import get_settings
from app.exceptions import GeocodingError
from app.logging_config import update_request_logging
from app.schemas.input import GeocodeResult


class GeocodingService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def geocode(self, location_text: str) -> GeocodeResult:
        if not location_text:
            raise GeocodingError("Farm location is required")

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                response = client.get(
                    f"{self.settings.nominatim_base_url}/search",
                    params={"q": location_text, "format": "jsonv2", "limit": 1},
                    headers={"User-Agent": "AgriFlow/0.1"},
                )
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise GeocodingError("Geocoding timed out") from exc
        except httpx.HTTPError as exc:
            raise GeocodingError("Geocoding lookup failed") from exc

        results = response.json()
        if not results:
            raise GeocodingError("No matching farm location found")

        first_result = results[0]
        geocode_result = GeocodeResult(
            latitude=float(first_result["lat"]),
            longitude=float(first_result["lon"]),
            display_name=str(first_result.get("display_name", location_text)),
            confidence=1.0,
        )
        update_request_logging(geocoding_confidence=geocode_result.confidence)
        return geocode_result

    def check_health(self) -> dict[str, str]:
        return {"status": "configured", "url": self.settings.nominatim_base_url}
