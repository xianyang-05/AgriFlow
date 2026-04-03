class ConversionError(ValueError):
    pass


def convert_area(text: str) -> float:
    from app.unit_conversion.area import convert_area_to_m2

    return convert_area_to_m2(text)


def convert_budget(text: str) -> float:
    from app.unit_conversion.budget import convert_budget_to_myr

    return convert_budget_to_myr(text)
