"""
Validator layer — checks all user input against the data catalogs.
Returns helpful error messages with suggestions on failure.
"""

import json
from pathlib import Path

from backend.config import BASE_DIR

DATA_DIR = BASE_DIR / "backend" / "data"

# Load catalogs once at import
with open(DATA_DIR / "valid_drivers.json") as f:
    DRIVERS = json.load(f)

with open(DATA_DIR / "valid_constructors.json") as f:
    CONSTRUCTORS = json.load(f)

with open(DATA_DIR / "valid_circuits.json") as f:
    CIRCUITS = json.load(f)

with open(DATA_DIR / "valid_seasons.json") as f:
    SEASONS = json.load(f)

with open(DATA_DIR / "aliases.json") as f:
    ALIASES = json.load(f)

VALID_SESSIONS = {"R", "Q", "S", "SQ", "SS", "FP1", "FP2", "FP3", "ALL"}


class ValidationError(ValueError):
    def __init__(self, message: str, suggestions: list[str] | None = None):
        self.message = message
        self.suggestions = suggestions or []
        super().__init__(message)


def resolve_alias(text: str) -> str | None:
    text = text.strip().lower()
    return ALIASES.get(text)


def validate_driver(code: str, year: int | None = None) -> dict:
    code = code.upper().strip()
    if code not in DRIVERS:
        valid = sorted(DRIVERS.keys())
        msg = f"Driver '{code}' not found."
        suggestions = valid[:10]
        raise ValidationError(msg, suggestions)

    info = DRIVERS[code]

    if year is not None:
        year_str = str(year)
        if year_str not in info["teams"]:
            active_years = sorted(info["teams"].keys())
            msg = f"Driver '{code}' did not race in {year}. Active years: {active_years[0]}-{active_years[-1]}"
            raise ValidationError(msg)

        return {
            "code": code,
            "full_name": info["full_name"],
            "team": info["teams"][year_str],
            "year": year,
        }

    return {
        "code": code,
        "full_name": info["full_name"],
        "teams": info["teams"],
    }


def validate_circuit(key: str) -> dict:
    key = key.strip().lower()
    if key not in CIRCUITS:
        valid = sorted(CIRCUITS.keys())
        msg = f"Circuit '{key}' not found."
        raise ValidationError(msg, valid)

    return {"key": key, "full_name": CIRCUITS[key]}


def validate_constructor(slug: str, year: int | None = None) -> dict:
    slug = slug.strip().lower()
    if slug not in CONSTRUCTORS:
        valid = sorted(CONSTRUCTORS.keys())
        msg = f"Constructor '{slug}' not found."
        raise ValidationError(msg, valid)

    info = CONSTRUCTORS[slug]

    if year is not None:
        year_str = str(year)
        if year_str not in info.get("drivers", {}):
            msg = f"Constructor '{info.get('full_name', slug)}' did not compete in {year}."
            raise ValidationError(msg)
        return {
            "slug": slug,
            "full_name": info["full_name"],
            "drivers": info["drivers"][year_str],
            "year": year,
        }

    return {"slug": slug, "full_name": info["full_name"]}


def validate_season(year: int) -> dict:
    if year not in SEASONS:
        msg = f"Season {year} not available."
        raise ValidationError(msg, [SEASONS[0], SEASONS[-1]])
    return {"year": year}


def validate_session(session_code: str) -> str:
    code = session_code.strip().upper()
    if code not in VALID_SESSIONS:
        msg = f"Invalid session '{code}'. Valid sessions: {', '.join(sorted(VALID_SESSIONS))}"
        valid_list = sorted(VALID_SESSIONS)
        raise ValidationError(msg, valid_list)
    return code


def get_drivers_for_year(year: int) -> list[dict]:
    year_str = str(year)
    result = []
    for code, info in DRIVERS.items():
        if year_str in info["teams"]:
            result.append({
                "code": code,
                "full_name": info["full_name"],
                "team": info["teams"][year_str],
            })
    return sorted(result, key=lambda d: d["code"])


def get_constructors_for_year(year: int) -> list[dict]:
    year_str = str(year)
    result = []
    for slug, info in CONSTRUCTORS.items():
        if year_str in info.get("drivers", {}):
            result.append({
                "slug": slug,
                "full_name": info.get("full_name", slug),
                "drivers": info["drivers"][year_str],
            })
    return sorted(result, key=lambda c: c["slug"])


def resolve_drivers(raw_drivers: list[str], year: int | None = None) -> list[dict]:
    validated = []
    errors = []
    for raw in raw_drivers:
        code = resolve_alias(raw) or raw.upper().strip()
        try:
            validated.append(validate_driver(code, year))
        except ValidationError as e:
            errors.append({"input": raw, "error": e.message, "suggestions": e.suggestions})
    return validated, errors


def resolve_constructors(raw_slugs: list[str], year: int | None = None) -> list[dict]:
    validated = []
    errors = []
    for raw in raw_slugs:
        try:
            validated.append(validate_constructor(raw, year))
        except ValidationError as e:
            errors.append({"input": raw, "error": e.message, "suggestions": e.suggestions})
    return validated, errors
