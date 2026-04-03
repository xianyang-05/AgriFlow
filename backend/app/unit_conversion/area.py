import re

from app.unit_conversion.registry import ConversionError


AREA_FACTORS = {
    "m2": 1.0,
    "sqm": 1.0,
    "square meter": 1.0,
    "square meters": 1.0,
    "acre": 4046.8564224,
    "acres": 4046.8564224,
    "ekar": 4046.8564224,
    "rai": 1600.0,
    "hectare": 10000.0,
    "hectares": 10000.0,
    "football field": 7140.0,
    "football fields": 7140.0,
}


def convert_area_to_m2(text: str) -> float:
    cleaned = text.strip().lower().replace(",", "")
    match = re.search(r"(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>[a-z ]+)", cleaned)
    if not match:
        raise ConversionError(f"Unknown area format: {text}")

    value = float(match.group("value"))
    unit = match.group("unit").strip()
    if unit not in AREA_FACTORS:
        raise ConversionError(f"Unknown area unit: {unit}")
    return value * AREA_FACTORS[unit]
