"""
Race action endpoints — compare, telemetry, standings.

NOTE: GET resource endpoints (drivers, circuits, etc.) are in resources.py.
"""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import fastf1
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from backend.config import BASE_DIR
from backend.models.schemas import (
    CompareRequest,
    CompareResponse,
    GearTrackResponse,
    LapsRequest,
    MultiTelemetryRequest,
    MultiTelemetryResponse,
    PositionChangesRequest,
    PositionChangesResponse,
    QualifyingRequest,
    QualifyingResponse,
    StandingsResponse,
    TeamPaceRequest,
    TeamPaceResponse,
    TelemetryRequest,
    TelemetryResponse,
    TyreStrategiesRequest,
    TyreStrategiesResponse,
)

from backend.services.fastf1_analyzer import compare_drivers, compare_constructors, _EVENT_OVERRIDES
from backend.services.standings_service import driver_standings, constructor_standings
from backend.services.position_service import position_changes
from backend.services.qualifying_service import qualifying_results
from backend.services.team_pace_service import team_pace
from backend.services.tyre_service import tyre_strategies
from backend.services.telemetry_service import single_lap_telemetry, lap_progression, multi_driver_telemetry, gear_shift_track
from backend.services.validator import (
    resolve_drivers,
    resolve_constructors,
    validate_circuit,
    validate_season,
    validate_session,
    ValidationError,
)

router = APIRouter()


@router.post("/compare", response_model=CompareResponse)
async def compare(body: CompareRequest):
    if body.drivers and body.constructors:
        raise HTTPException(400, detail="drivers and constructors are mutually exclusive")
    if not body.drivers and not body.constructors:
        raise HTTPException(400, detail="Provide either drivers or constructors")

    entities = body.drivers or body.constructors
    max_count = 5
    if len(entities) > max_count:
        raise HTTPException(400, detail=f"Max {max_count} entities per comparison")

    try:
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(400, detail=e.message)

    if body.circuit:
        try:
            validate_circuit(body.circuit)
        except ValidationError as e:
            raise HTTPException(404, detail=e.message)

    if body.year:
        try:
            validate_season(body.year)
        except ValidationError as e:
            raise HTTPException(404, detail=e.message)

    try:
        if body.drivers:
            resolved, errors = resolve_drivers(body.drivers, body.year)
            if errors:
                raise HTTPException(404, detail=errors[0])

            codes = [d["code"] for d in resolved]
            return compare_drivers(codes, body.circuit, body.year, body.session)

        if body.constructors:
            return compare_constructors(body.constructors, body.circuit, body.year, body.session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, detail=f"Compare failed: {type(e).__name__}")

    raise HTTPException(400, "Unreachable")


@router.get("/standings", response_model=StandingsResponse)
async def standings(
    year: int | None = None,
    type: str = Query("driver", alias="type"),
    round: int | None = None,
):
    if year is None:
        from backend.services.fastf1_analyzer import SEASONS
        year = max(SEASONS)

    try:
        validate_season(year)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        if type == "driver":
            data = driver_standings(year, round)
        elif type == "constructor":
            data = constructor_standings(year, round)
        else:
            raise HTTPException(400, detail="type must be 'driver' or 'constructor'")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, detail=f"Standings failed: {type(e).__name__}")

    return StandingsResponse(
        year=year,
        type=type,
        round=round,
        standings=data,
        chart=None,
    )


@router.post("/telemetry", response_model=TelemetryResponse)
async def telemetry(body: TelemetryRequest):
    if body.year is None:
        from backend.services.fastf1_analyzer import SEASONS
        body.year = max(SEASONS)

    try:
        validate_circuit(body.circuit)
        validate_season(body.year)
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        result = single_lap_telemetry(
            driver=body.driver,
            circuit=body.circuit,
            year=body.year,
            session_type=body.session,
            lap_number=body.lap_number,
            metric=body.metric or "speed",
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Telemetry failed: {type(e).__name__}")

    if "error" in result:
        raise HTTPException(404, detail=result["error"])

    return TelemetryResponse(
        driver=result["driver"],
        circuit=result["circuit"],
        lap=result.get("lap"),
        stats=result["stats"],
        telemetry=result.get("telemetry"),
        chart=result.get("chart"),
        track_chart=result.get("track_chart"),
    )


@router.post("/telemetry/compare", response_model=MultiTelemetryResponse)
async def telemetry_compare(body: MultiTelemetryRequest):
    if len(body.drivers) < 2:
        raise HTTPException(400, detail="Need at least 2 drivers to compare")

    try:
        validate_circuit(body.circuit)
        validate_season(body.year)
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        result = multi_driver_telemetry(
            drivers=body.drivers,
            circuit=body.circuit,
            year=body.year,
            session_type=body.session,
            lap_number=body.lap_number,
            metric=body.metric,
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Telemetry compare failed: {type(e).__name__}")

    if "error" in result:
        raise HTTPException(404, detail=result["error"])

    return MultiTelemetryResponse(
        circuit=result["circuit"],
        year=result["year"],
        session=result["session"],
        metric=result["metric"],
        drivers=result["drivers"],
        chart=result.get("chart"),
    )


@router.post("/laps")
async def laps(body: LapsRequest):
    try:
        validate_circuit(body.circuit)
        validate_season(body.year)
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        result = lap_progression(
            driver=body.driver,
            circuit=body.circuit,
            year=body.year,
            session_type=body.session,
            max_laps=body.max_laps,
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Lap data failed: {type(e).__name__}")

    if not result:
        return [{
            "driver": body.driver, "circuit": body.circuit, "year": body.year,
            "lap_number": 0, "dnf": True, "lap_time": "DNF",
        }]

    return result


@router.post("/telemetry/gear-track", response_model=GearTrackResponse)
async def gear_track(body: TelemetryRequest):
    try:
        validate_circuit(body.circuit)
        validate_season(body.year)
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        result = gear_shift_track(
            driver=body.driver,
            circuit=body.circuit,
            year=body.year,
            session_type=body.session,
            lap_number=body.lap_number,
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Gear track failed: {type(e).__name__}")

    if "error" in result:
        raise HTTPException(404, detail=result["error"])

    return GearTrackResponse(
        driver=result["driver"],
        circuit=result["circuit"],
        year=result["year"],
        session=result["session"],
        lap=result.get("lap"),
        chart=result.get("chart"),
    )


@router.post("/position-changes", response_model=PositionChangesResponse)
async def position_changes_endpoint(body: PositionChangesRequest):
    try:
        validate_circuit(body.circuit)
        validate_season(body.year)
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        result = position_changes(
            circuit=body.circuit,
            year=body.year,
            session_type=body.session,
            driver=body.driver,
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Position changes failed: {type(e).__name__}")

    return PositionChangesResponse(
        circuit=result["circuit"],
        year=result["year"],
        session=result["session"],
        drivers=result["drivers"],
        chart=result.get("chart"),
    )


@router.post("/team-pace", response_model=TeamPaceResponse)
async def team_pace_endpoint(body: TeamPaceRequest):
    try:
        validate_circuit(body.circuit)
        validate_season(body.year)
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        result = team_pace(
            circuit=body.circuit,
            year=body.year,
            session_type=body.session,
            driver=body.driver,
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Team pace failed: {type(e).__name__}")

    if "error" in result:
        raise HTTPException(404, detail=result["error"])

    return TeamPaceResponse(
        circuit=result["circuit"],
        year=result["year"],
        session=result["session"],
        driver=result.get("driver"),
        chart=result.get("chart"),
    )


@router.post("/tyre-strategies", response_model=TyreStrategiesResponse)
async def tyre_strategies_endpoint(body: TyreStrategiesRequest):
    try:
        validate_circuit(body.circuit)
        validate_season(body.year)
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        result = tyre_strategies(
            circuit=body.circuit,
            year=body.year,
            session_type=body.session,
            driver=body.driver,
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Tyre strategies failed: {type(e).__name__}")

    if "error" in result:
        raise HTTPException(404, detail=result["error"])

    return TyreStrategiesResponse(
        circuit=result["circuit"],
        year=result["year"],
        session=result["session"],
        driver=result.get("driver"),
        chart=result.get("chart"),
    )


@router.post("/qualifying", response_model=QualifyingResponse)
async def qualifying_endpoint(body: QualifyingRequest):
    try:
        validate_circuit(body.circuit)
        validate_season(body.year)
        validate_session(body.session)
    except ValidationError as e:
        raise HTTPException(404, detail=e.message)

    try:
        result = qualifying_results(
            circuit=body.circuit,
            year=body.year,
            session_type=body.session,
            driver=body.driver,
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Qualifying results failed: {type(e).__name__}")

    if "error" in result:
        raise HTTPException(404, detail=result["error"])

    return QualifyingResponse(
        circuit=result["circuit"],
        year=result["year"],
        session=result["session"],
        driver=result.get("driver"),
        chart=result.get("chart"),
    )


@router.get("/schedule/{year}")
async def race_schedule(year: int):
    try:
        schedule = fastf1.get_event_schedule(year)
    except Exception:
        raise HTTPException(502, detail=f"Could not load schedule for {year}")

    event_to_key = {v: k for k, v in _EVENT_OVERRIDES.items()}
    lookup_keys = list(_EVENT_OVERRIDES.keys())

    races = []
    for _, ev in schedule.iterrows():
        event_name = ev.get("EventName", "")
        if not event_name:
            continue
        round_num = int(ev.get("RoundNumber", 0))
        if round_num == 0:
            continue
        event_date = str(ev.get("EventDate", ev.get("Session1Date", "")))
        event_format = str(ev.get("EventFormat", "conventional"))
        sprint = event_format == "sprint"

        circuit_key = event_to_key.get(event_name)
        if circuit_key is None:
            en_lower = event_name.lower()
            for lk in lookup_keys:
                if lk.replace("_", " ") in en_lower or _EVENT_OVERRIDES[lk].lower() in en_lower:
                    circuit_key = lk
                    break

        sessions = []
        for i in range(1, 6):
            sname = ev.get(f"Session{i}")
            slocal = ev.get(f"Session{i}Date")
            sutc = ev.get(f"Session{i}DateUtc")
            if sname and str(sname) != "nan":
                sessions.append({
                    "name": str(sname),
                    "date_local": str(slocal) if str(slocal) != "NaT" else None,
                    "date_utc": str(sutc) if str(sutc) != "NaT" else None,
                })

        races.append({
            "round": round_num,
            "event": event_name,
            "circuit_key": circuit_key or event_name.lower().replace(" ", "_"),
            "date": event_date[:10],
            "sprint": sprint,
            "sessions": sessions,
        })

    races.sort(key=lambda r: r["round"])
    return {"year": year, "races": races}


_LIVE_CACHE_PATH = BASE_DIR / "backend" / "data" / "live_season.json"
_LIVE_CACHE_TTL = timedelta(days=15)


def _build_live_season_cache() -> dict:
    """Fetch all live-season data from FastF1 (blocking — run in thread pool)."""
    from datetime import datetime, timezone
    from backend.services.fastf1_analyzer import _EVENT_OVERRIDES, SEASONS, race_results as _race_results
    from backend.services.standings_service import driver_standings, constructor_standings

    now = datetime.now(timezone.utc)
    year = now.year

    # Schedule
    sched = fastf1.get_event_schedule(year)
    event_to_key = {v: k for k, v in _EVENT_OVERRIDES.items()}
    lookup_keys = list(_EVENT_OVERRIDES.keys())

    schedule_races = []
    for _, ev in sched.iterrows():
        en = ev.get("EventName", "")
        if not en:
            continue
        rn = int(ev.get("RoundNumber", 0))
        if rn == 0:
            continue
        event_date = str(ev.get("EventDate", ev.get("Session1Date", "")))
        event_format = str(ev.get("EventFormat", "conventional"))
        sprint = event_format == "sprint"

        circuit_key = event_to_key.get(en)
        if circuit_key is None:
            en_lower = en.lower()
            for lk in lookup_keys:
                if lk.replace("_", " ") in en_lower or _EVENT_OVERRIDES[lk].lower() in en_lower:
                    circuit_key = lk
                    break

        sessions = []
        for i in range(1, 6):
            sname = ev.get(f"Session{i}")
            slocal = ev.get(f"Session{i}Date")
            sutc = ev.get(f"Session{i}DateUtc")
            if sname and str(sname) != "nan":
                sessions.append({
                    "name": str(sname),
                    "date_local": str(slocal) if str(slocal) != "NaT" else None,
                    "date_utc": str(sutc) if str(sutc) != "NaT" else None,
                })

        schedule_races.append({
            "round": rn,
            "event": en,
            "circuit_key": circuit_key or en.lower().replace(" ", "_"),
            "date": event_date[:10],
            "sprint": sprint,
            "sessions": sessions,
        })
    schedule_races.sort(key=lambda r: r["round"])

    # Standings
    ds = driver_standings(year)
    cs = constructor_standings(year)

    # Next race
    all_races = []
    for _, ev in sched.iterrows():
        rn = int(ev.get("RoundNumber", 0))
        if rn == 0:
            continue
        race_utc = ev.get("Session5DateUtc")
        if race_utc is None or str(race_utc) == "NaT":
            continue
        dt = race_utc.to_pydatetime()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt > now:
            all_races.append((ev, dt))
    all_races.sort(key=lambda x: x[1])

    next_race_data = None
    if all_races:
        next_ev, race_dt = all_races[0]
        sprint = str(next_ev.get("EventFormat", "conventional")) == "sprint"
        next_session = None
        sessions_list = []
        for i in range(1, 6):
            sname = next_ev.get(f"Session{i}")
            sutc = next_ev.get(f"Session{i}DateUtc")
            if sname and str(sname) != "nan" and sutc is not None and str(sutc) != "NaT":
                dt = sutc.to_pydatetime()
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                diff = (dt - now).total_seconds()
                sessions_list.append({
                    "name": str(sname),
                    "date_utc": str(sutc),
                    "timestamp": dt.isoformat(),
                    "seconds_until": int(diff),
                })
                if diff > 0 and next_session is None:
                    next_session = {
                        "name": str(sname),
                        "timestamp": dt.isoformat(),
                        "seconds_until": int(diff),
                    }
        race_countdown = int((race_dt - now).total_seconds())
        event_name = str(next_ev.get("EventName", ""))
        circuit_key = event_to_key.get(event_name)
        if circuit_key is None:
            en_lower = event_name.lower()
            for lk in lookup_keys:
                if lk.replace("_", " ") in en_lower or _EVENT_OVERRIDES[lk].lower() in en_lower:
                    circuit_key = lk
                    break
        next_race_data = {
            "season_over": False,
            "year": year,
            "round": int(next_ev.get("RoundNumber", 0)),
            "event": event_name,
            "circuit_key": circuit_key or event_name.lower().replace(" ", "_"),
            "date": str(next_ev.get("EventDate", ""))[:10],
            "sprint": sprint,
            "sessions": sessions_list,
            "next_session": next_session,
            "countdown_seconds": race_countdown,
        }

    # Latest race — find the last completed race
    latest_race_data = None
    completed_races = [r for r in schedule_races if r["date"] < now.strftime("%Y-%m-%d")]
    for race in reversed(completed_races):
        try:
            rr = _race_results(race["circuit_key"], year, "R")
            if rr.get("results") and any(
                rs.get("status") == "Finished" for rs in rr["results"]
            ):
                latest_race_data = {
                    "circuit": race["circuit_key"],
                    "results": rr["results"],
                    "fastest_lap": rr.get("fastest_lap"),
                    "weather": rr.get("weather"),
                    "dnfs": rr.get("dnfs", []),
                }
                break
        except Exception:
            continue

    return {
        "year": year,
        "cachedAt": now.isoformat(),
        "driverStandings": ds,
        "constructorStandings": cs,
        "schedule": schedule_races,
        "nextRace": next_race_data,
        "latestRace": latest_race_data,
    }


async def _refresh_cache():
    """Rebuild cache in background thread to avoid blocking the event loop."""
    try:
        data = await asyncio.to_thread(_build_live_season_cache)
        _LIVE_CACHE_PATH.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    except Exception as e:
        print(f"[live-season] Background refresh failed: {e}", flush=True)


@router.get("/live-season")
async def live_season():
    now = datetime.now(timezone.utc)

    # Try to serve from cache
    if _LIVE_CACHE_PATH.exists():
        try:
            raw = _LIVE_CACHE_PATH.read_text(encoding="utf-8")
            cached = json.loads(raw)
            cached_at = datetime.fromisoformat(cached["cachedAt"])
            age = now - cached_at

            if age < _LIVE_CACHE_TTL:
                return cached

            # Stale — return cached, refresh in background
            asyncio.create_task(_refresh_cache())
            return cached
        except Exception:
            pass  # Corrupt cache — rebuild

    # No cache or corrupt — build fresh
    data = await asyncio.to_thread(_build_live_season_cache)
    try:
        _LIVE_CACHE_PATH.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    except Exception as e:
        print(f"[live-season] Cache write failed: {e}", flush=True)
    return data


@router.get("/next")
async def next_race():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    try:
        year = now.year
        schedule = fastf1.get_event_schedule(year)
    except Exception:
        year = now.year - 1
        try:
            schedule = fastf1.get_event_schedule(year)
        except Exception as e:
            raise HTTPException(502, detail=f"Could not load schedule: {e}")

    # If late in year and no upcoming races, try next year
    all_races = []
    found_upcoming = False
    while year <= now.year + 1:
        for _, ev in schedule.iterrows():
            rn = int(ev.get("RoundNumber", 0))
            if rn == 0:
                continue
            race_utc = ev.get("Session5DateUtc")
            if race_utc is None or str(race_utc) == "NaT":
                continue
            dt = race_utc.to_pydatetime()
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt > now:
                found_upcoming = True
                all_races.append((ev, dt))
        if found_upcoming:
            break
        year += 1
        try:
            schedule = fastf1.get_event_schedule(year)
        except Exception:
            break

    if not all_races:
        return {
            "next_race": None,
            "next_session": None,
            "countdown_seconds": 0,
            "season_over": True,
        }

    all_races.sort(key=lambda x: x[1])
    next_ev, race_dt = all_races[0]
    event_format = str(next_ev.get("EventFormat", "conventional"))
    sprint = event_format == "sprint"

    # Find the next upcoming session within this weekend
    next_session = None
    sessions_list = []
    for i in range(1, 6):
        sname = next_ev.get(f"Session{i}")
        sutc = next_ev.get(f"Session{i}DateUtc")
        if sname and str(sname) != "nan" and sutc is not None and str(sutc) != "NaT":
            dt = sutc.to_pydatetime()
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            diff = (dt - now).total_seconds()
            sessions_list.append({
                "name": str(sname),
                "date_utc": str(sutc),
                "timestamp": dt.isoformat(),
                "seconds_until": int(diff),
            })
            if diff > 0 and next_session is None:
                next_session = {
                    "name": str(sname),
                    "timestamp": dt.isoformat(),
                    "seconds_until": int(diff),
                }

    race_countdown = int((race_dt - now).total_seconds())

    event_to_key = {v: k for k, v in _EVENT_OVERRIDES.items()}
    lookup_keys = list(_EVENT_OVERRIDES.keys())
    event_name = str(next_ev.get("EventName", ""))
    circuit_key = event_to_key.get(event_name)
    if circuit_key is None:
        en_lower = event_name.lower()
        for lk in lookup_keys:
            if lk.replace("_", " ") in en_lower or _EVENT_OVERRIDES[lk].lower() in en_lower:
                circuit_key = lk
                break

    return {
        "season_over": False,
        "year": year,
        "round": int(next_ev.get("RoundNumber", 0)),
        "event": event_name,
        "circuit_key": circuit_key or event_name.lower().replace(" ", "_"),
        "date": str(next_ev.get("EventDate", ""))[:10],
        "sprint": sprint,
        "sessions": sessions_list,
        "next_session": next_session,
        "countdown_seconds": int(race_countdown),
    }
