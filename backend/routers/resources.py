"""
Resource endpoints — quick-lookup GET routes for drivers, circuits,
constructors, seasons, and race results.
"""

import fastf1
from fastapi import APIRouter, HTTPException

from backend.config import FASTF1_CACHE_DIR
from backend.services.fastf1_analyzer import SEASONS, career_stats, race_results, _event_name
from backend.services.standings_service import driver_standings, constructor_standings
from backend.services.validator import (
    DRIVERS,
    CIRCUITS,
    CONSTRUCTORS,
    ALIASES,
    validate_driver,
    validate_circuit,
    validate_season,
    ValidationError,
)

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))

router = APIRouter()


# ---- Drivers ----

@router.get("/drivers")
async def list_drivers(year: int | None = None):
    out = []
    for code, info in DRIVERS.items():
        if year is not None and str(year) not in info["teams"]:
            continue
        team = next(iter(info["teams"].values()), None)
        out.append({"code": code, "full_name": info["full_name"], "team": team})
    return sorted(out, key=lambda d: d["code"])


@router.get("/drivers/{code}")
async def driver_career(code: str):
    code = code.upper().strip()
    try:
        info = validate_driver(code)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        stats = career_stats([code])
    except Exception as e:
        raise HTTPException(502, detail=f"Failed to load career data: {type(e).__name__}")
    career = stats.get(code, {})

    # Enrich from catalog — team per year
    per_season = []
    for entry in career.get("per_season", []):
        year = entry["year"]
        team = info["teams"].get(str(year), "Unknown")
        per_season.append({
            "year": year,
            "team": team,
            "wins": entry["wins"],
            "points": entry["points"],
            "position": entry["position"],
        })

    return {
        "code": code,
        "full_name": info["full_name"],
        "career": {
            "seasons": career.get("seasons", 0),
            "wins": career.get("total_wins", 0),
            "points": career.get("total_points", 0),
            "best_championship": career.get("best_championship"),
        },
        "per_season": per_season,
    }


# ---- Circuits ----

@router.get("/circuits")
async def list_circuits():
    return [{"key": k, "full_name": v} for k, v in sorted(CIRCUITS.items())]


@router.get("/circuits/{key}")
async def circuit_detail(key: str):
    try:
        info = validate_circuit(key)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    winners = []
    for year in SEASONS:
        try:
            event = _event_name(year, key)
            session = fastf1.get_session(year, event, "R")
            session.load(telemetry=False, weather=False, messages=False)
            res = session.results
            if res is not None and not res.empty:
                w = res.iloc[0]
                winners.append({
                    "year": year,
                    "winner": w.get("Abbreviation", "?"),
                    "team": w.get("TeamName", "?"),
                })
        except Exception:
            continue

    return {
        "key": key,
        "full_name": info["full_name"],
        "winners_by_year": winners,
    }


# ---- Constructors ----

@router.get("/constructors")
async def list_constructors():
    out = []
    for slug, info in CONSTRUCTORS.items():
        latest_year = max(info.get("drivers", {}).keys(), default="")
        drivers = info.get("drivers", {}).get(latest_year, [])
        out.append({
            "id": slug,
            "full_name": info.get("full_name", slug),
            "drivers": drivers,
        })
    return sorted(out, key=lambda c: c["id"])


@router.get("/constructors/{slug}")
async def constructor_detail(slug: str):
    slug = slug.strip().lower()
    if slug not in CONSTRUCTORS:
        raise HTTPException(404, detail=f"Constructor '{slug}' not found.")

    info = CONSTRUCTORS[slug]

    # Get standings per year
    eras = []
    for year in SEASONS:
        yr = str(year)
        try:
            standings = constructor_standings(year)
            for entry in standings:
                if entry["id"] == slug:
                    eras.append({
                        "year": year,
                        "wins": entry["wins"],
                        "points": entry["points"],
                        "position": entry["position"],
                    })
                    break
        except Exception:
            continue

    drivers = info.get("drivers", {})
    all_drivers = sorted(set(
        d for yr_drivers in drivers.values() for d in yr_drivers
    ))

    return {
        "id": slug,
        "full_name": info.get("full_name", slug),
        "drivers": all_drivers,
        "per_season": eras,
    }


# ---- Races ----

@router.get("/races")
async def race_calendar(year: int | None = None):
    if year is None:
        year = max(SEASONS)
    try:
        validate_season(year)
        schedule = fastf1.get_event_schedule(year)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)
    except Exception as e:
        raise HTTPException(502, detail=f"Failed to load race schedule: {type(e).__name__}")

    rounds = []
    for _, ev in schedule.iterrows():
        circuit_key = str(ev.get("Location", "")).lower().replace(" ", "_")
        # Try to map back to our circuit keys
        mapped = None
        for ck in CIRCUITS:
            if ck in str(ev.get("EventName", "")).lower() or ck in circuit_key:
                mapped = ck
                break
        if mapped is None:
            mapped = circuit_key

        # Get winner
        winner = None
        try:
            session = fastf1.get_session(year, ev["EventName"], "R")
            session.load(telemetry=False, weather=False, messages=False)
            if session.results is not None and not session.results.empty:
                winner = session.results.iloc[0].get("Abbreviation")
        except Exception:
            pass

        rounds.append({
            "round": int(ev.get("RoundNumber", 0)),
            "circuit": mapped,
            "full_name": ev.get("EventName", ""),
            "date": str(ev.get("EventDate", ev.get("Session1Date", "")))[:10],
            "winner": winner,
        })

    return {"year": year, "rounds": rounds}


@router.get("/races/{circuit}")
async def race_detail(circuit: str, year: int | None = None, session: str = "R"):
    if year is None:
        year = max(SEASONS)
    try:
        validate_circuit(circuit)
        validate_season(year)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        return race_results(circuit, year, session)
    except Exception as e:
        raise HTTPException(502, detail=f"Failed to load race results: {type(e).__name__}")


# ---- Seasons ----

@router.get("/seasons")
async def list_seasons():
    return SEASONS


# ---- Aliases ----

@router.get("/aliases")
async def list_aliases():
    return ALIASES
