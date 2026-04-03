import re

from app.unit_conversion.registry import ConversionError


def convert_budget_to_myr(text: str) -> float:
    cleaned = text.strip().lower().replace(",", "")
    cleaned = cleaned.replace("myr", "").replace("rm", "").replace("$", "").replace("usd", "").strip()

    if cleaned.endswith("k"):
        numeric = cleaned[:-1].strip()
        if not numeric:
            raise ConversionError(f"Unknown budget format: {text}")
        return float(numeric) * 1000.0

    match = re.search(r"\d+(?:\.\d+)?", cleaned)
    if not match:
        raise ConversionError(f"Unknown budget format: {text}")
    return float(match.group(0))
