import httpx

from app.config import get_settings
from app.exceptions import AltitudeError


class AltitudeService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def get_altitude(self, latitude: float, longitude: float) -> float:
        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                response = client.get(
                    f"{self.settings.open_elevation_base_url}/lookup",
                    params={"locations": f"{latitude},{longitude}"},
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise AltitudeError("Altitude lookup failed") from exc

        payload = response.json()
        results = payload.get("results", [])
        if not results:
            raise AltitudeError("Altitude lookup returned no results")
        return float(results[0]["elevation"])

    def check_health(self) -> dict[str, str]:
        return {"status": "configured", "url": self.settings.open_elevation_base_url}
