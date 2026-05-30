"""
FastF1 core engine — career stats, race comparison, constructor comparison.

All functions return dicts ready to be wrapped in API responses.
Telemetry and standings are in separate modules (telemetry.py, standings_service.py).
"""

import time

import fastf1
import pandas as pd
from fastf1.ergast import Ergast

from backend.config import FASTF1_CACHE_DIR

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))

SEASONS = list(range(2000, 2027))

# Some circuit keys don't match FastF1's EventName or Location text.
# Hard-code those overrides here.
_EVENT_OVERRIDES = {
    "interlagos": "Sao Paulo Grand Prix",
    "cota": "United States Grand Prix",
    "hungaroring": "Hungarian Grand Prix",
    "singapore": "Singapore Grand Prix",
    "spa": "Belgian Grand Prix",
    "montreal": "Canadian Grand Prix",
    "losail": "Qatar Grand Prix",
    "qatar": "Qatar Grand Prix",
    "portimao": "Portuguese Grand Prix",
    "miami": "Miami Grand Prix",
    "baku": "Azerbaijan Grand Prix",
    "las_vegas": "Las Vegas Grand Prix",
    "abu_dhabi": "Abu Dhabi Grand Prix",
    "monaco": "Monaco Grand Prix",
    "monza": "Italian Grand Prix",
    "silverstone": "British Grand Prix",
    "spielberg": "Austrian Grand Prix",
    "suzuka": "Japanese Grand Prix",
    "zandvoort": "Dutch Grand Prix",
    "melbourne": "Australian Grand Prix",
    "bahrain": "Bahrain Grand Prix",
    "jeddah": "Saudi Arabian Grand Prix",
    "shanghai": "Chinese Grand Prix",
    "barcelona": "Spanish Grand Prix",
    "imola": "Emilia Romagna Grand Prix",
    "mexico": "Mexico City Grand Prix",
}


def _event_name(year: int, circuit: str) -> str:
    if circuit in _EVENT_OVERRIDES:
        return _EVENT_OVERRIDES[circuit]
    schedule = fastf1.get_event_schedule(year)
    cl = circuit.lower().replace("_", " ")
    for _, ev in schedule.iterrows():
        if cl in str(ev.get("EventName", "")).lower() or cl in str(ev.get("Location", "")).lower():
            return ev["EventName"]
    raise ValueError(f"Circuit '{circuit}' not found in {year} schedule")


def career_stats(driver_codes: list[str]) -> dict:
    """
    Career stats for one or more drivers.
    Uses Ergast driver standings per year, aggregated.
    """
    ergast = Ergast()
    result = {}

    for code in driver_codes:
        code = code.upper().strip()
        total_points = 0
        total_wins = 0
        total_seasons = 0
        best_pos = 99
        seasons_data = []

        for year in SEASONS:
            try:
                standings = ergast.get_driver_standings(year)
                time.sleep(0.3)
            except Exception:
                continue
            if not standings or not standings.content:
                continue

            try:
                df = standings.content[0]
                row = df[df["driverCode"] == code]
                if row.empty:
                    continue

                r = row.iloc[0]
                pos = int(r["position"])
                pts = float(r["points"])
                wins = int(r["wins"])
            except (ValueError, KeyError, IndexError):
                continue

            total_points += pts
            total_wins += wins
            total_seasons += 1
            best_pos = min(best_pos, pos)

            seasons_data.append({
                "year": year,
                "position": pos,
                "points": pts,
                "wins": wins,
            })

        if total_seasons == 0:
            continue

        result[code] = {
            "seasons": total_seasons,
            "total_points": total_points,
            "total_wins": total_wins,
            "best_championship": best_pos,
            "avg_points_per_season": round(total_points / total_seasons, 1),
            "per_season": seasons_data,
        }

    return result


def _aggregate_from_session_results(
    driver_codes: list[str],
    session,
) -> dict:
    """Extract position/status from a loaded session for each driver."""
    out = {}
    for code in driver_codes:
        code = code.upper().strip()
        if session.results is None or session.results.empty:
            out[code] = None
            continue
        row = session.results[session.results["Abbreviation"] == code]
        if row.empty:
            out[code] = None
            continue
        r = row.iloc[0]
        pos = r.get("Position")
        try:
            position = int(pos)
        except (ValueError, TypeError):
            position = 0
        out[code] = {
            "position": position,
            "status": r.get("Status", "Finished"),
        }
    return out


def season_aggregate(driver_codes: list[str], year: int) -> dict:
    """Aggregate results across all races in a season for selected drivers."""
    driver_codes = [c.upper().strip() for c in driver_codes]
    schedule = fastf1.get_event_schedule(year)
    buckets = {code: {"races": 0, "wins": 0, "podiums": 0, "positions": [], "dnfs": 0, "poles": 0, "fastest_laps": 0} for code in driver_codes}

    for _, ev in schedule.iterrows():
        event_name = ev.get("EventName", "")
        try:
            session = fastf1.get_session(year, event_name, "R")
            session.load(telemetry=False, weather=False, messages=False)
        except Exception:
            continue
        results = _aggregate_from_session_results(driver_codes, session)

        fastest_lap_code = None
        try:
            fl = session.laps.pick_fastest()
            if not fl.empty:
                fastest_lap_code = fl["Driver"]
        except Exception:
            pass

        for code, data in results.items():
            if data is None:
                continue
            pos = data["position"]
            buckets[code]["races"] += 1
            buckets[code]["positions"].append(pos)
            if pos == 1:
                buckets[code]["wins"] += 1
            if 1 <= pos <= 3:
                buckets[code]["podiums"] += 1
            if data.get("status", "Finished") != "Finished":
                buckets[code]["dnfs"] += 1

        try:
            if session.results is not None and not session.results.empty:
                for code in driver_codes:
                    row = session.results[session.results["Abbreviation"] == code]
                    if not row.empty:
                        grid = row.iloc[0].get("GridPosition")
                        try:
                            if pd.notna(grid) and int(grid) == 1:
                                buckets[code]["poles"] += 1
                        except (ValueError, TypeError):
                            pass
        except Exception:
            pass

        try:
            if fastest_lap_code:
                for code in driver_codes:
                    if code == fastest_lap_code:
                        buckets[code]["fastest_laps"] += 1
        except Exception:
            pass

    ergast = Ergast()
    champ_positions = {}
    try:
        standings = ergast.get_driver_standings(year)
        time.sleep(0.3)
        if standings and standings.content:
            df = standings.content[0]
            for code in driver_codes:
                row = df[df["driverCode"] == code]
                if not row.empty:
                    champ_positions[code] = int(row.iloc[0]["position"])
    except Exception:
        pass

    result = {}
    for code in driver_codes:
        s = buckets[code]
        if s["races"] == 0:
            result[code] = None
        else:
            entry = {
                "races": s["races"],
                "wins": s["wins"],
                "podiums": s["podiums"],
                "poles": s["poles"],
                "fastest_laps": s["fastest_laps"],
                "best_position": min(s["positions"]),
                "dnfs": s["dnfs"],
            }
            if code in champ_positions:
                entry["championship_position"] = champ_positions[code]
            result[code] = entry
    return result


def circuit_alltime(driver_codes: list[str], circuit: str) -> dict:
    """Aggregate results across all years at a specific circuit."""
    driver_codes = [c.upper().strip() for c in driver_codes]
    buckets = {code: {"races": 0, "wins": 0, "podiums": 0, "positions": [], "dnfs": 0, "poles": 0, "best_fastest_lap_raw": None} for code in driver_codes}

    for year in range(2012, 2026):
        try:
            event = _event_name(year, circuit)
        except ValueError:
            continue
        try:
            session = fastf1.get_session(year, event, "R")
            session.load(telemetry=False, weather=False, messages=False)
        except Exception:
            continue
        results = _aggregate_from_session_results(driver_codes, session)

        for code, data in results.items():
            if data is None:
                continue
            pos = data["position"]
            buckets[code]["races"] += 1
            buckets[code]["positions"].append(pos)
            if pos == 1:
                buckets[code]["wins"] += 1
            if 1 <= pos <= 3:
                buckets[code]["podiums"] += 1
            if data.get("status", "Finished") != "Finished":
                buckets[code]["dnfs"] += 1

        try:
            if session.results is not None and not session.results.empty:
                for code in driver_codes:
                    row = session.results[session.results["Abbreviation"] == code]
                    if not row.empty:
                        grid = row.iloc[0].get("GridPosition")
                        try:
                            if pd.notna(grid) and int(grid) == 1:
                                buckets[code]["poles"] += 1
                        except (ValueError, TypeError):
                            pass
        except Exception:
            pass

        try:
            for code in driver_codes:
                driver_laps = session.laps.pick_drivers([code])
                if not driver_laps.empty:
                    fl = driver_laps.pick_fastest()
                    if not fl.empty:
                        ft = fl["LapTime"]
                        if pd.notna(ft):
                            prev = buckets[code]["best_fastest_lap_raw"]
                            if prev is None or ft < prev:
                                buckets[code]["best_fastest_lap_raw"] = ft
        except Exception:
            pass

    def _clean(s):
        if s is None:
            return None
        st = str(s)
        if st.startswith("0 days "):
            st = st[7:]
        return st

    result = {}
    for code in driver_codes:
        s = buckets[code]
        if s["races"] == 0:
            result[code] = None
        else:
            result[code] = {
                "races": s["races"],
                "wins": s["wins"],
                "podiums": s["podiums"],
                "poles": s["poles"],
                "best_fastest_lap": _clean(s["best_fastest_lap_raw"]),
                "best_position": min(s["positions"]),
                "dnfs": s["dnfs"],
            }
    return result


def compare_drivers(
    driver_codes: list[str],
    circuit: str | None = None,
    year: int | None = None,
    session_type: str = "R",
) -> dict:
    """
    Compare N drivers across one of four modes:

      circuit=None,  year=None   → career_stats()  (all-time career via Ergast)
      circuit=None,  year=YYYY   → season_aggregate (all races in that season)
      circuit=XXX,  year=None    → circuit_alltime   (all years at that circuit)
      circuit=XXX,  year=YYYY    → session compare   (single race/qualifying)

    session_type: "R" (race) or "Q" (qualifying)
    """
    # Normalise: treat empty string the same as None
    circuit = circuit or None
    year = year or None

    # ── 1. Career mode ──
    if circuit is None and year is None:
        stats = career_stats(driver_codes)
        return {
            "type": "driver",
            "entities": driver_codes,
            "scope": {"mode": "career", "circuit": None, "year": None, "session": None},
            "stats": stats,
            "chart": None,
        }

    # ── 2. Season aggregate ──
    if circuit is None and year is not None:
        stats = season_aggregate(driver_codes, year)
        return {
            "type": "driver",
            "entities": driver_codes,
            "scope": {"mode": "season", "circuit": None, "year": year, "session": None},
            "stats": stats,
            "chart": None,
        }

    # ── 3. Circuit all-time ──
    if circuit is not None and year is None:
        stats = circuit_alltime(driver_codes, circuit)
        return {
            "type": "driver",
            "entities": driver_codes,
            "scope": {"mode": "circuit", "circuit": circuit, "year": None, "session": None},
            "stats": stats,
            "chart": None,
        }

    # ── 4. Single session ──
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=False, weather=True, messages=False)

    stats = {}
    for code in driver_codes:
        code = code.upper().strip()
        laps = session.laps.pick_drivers([code])

        if laps.empty:
            stats[code] = None
            continue

        fastest = laps.pick_fastest()

        # Position from results
        position = None
        res = session.results
        if res is not None and not res.empty:
            if "Abbreviation" in res.columns:
                row = res[res["Abbreviation"] == code]
            else:
                matches = [d for d in session.drivers if session.get_driver(d).get("Abbreviation") == code]
                if matches:
                    row = res[res["DriverNumber"].isin(matches)]
                else:
                    row = res.iloc[0:0]
            if not row.empty:
                position = int(row.iloc[0].get("Position", 0))

        avg_lap = laps["LapTime"].mean()
        fastest_time = fastest["LapTime"] if not fastest.empty else None
        pit_stops = int(laps["PitInTime"].notna().sum())
        laps_led = int((laps["Position"] == 1).sum()) if "Position" in laps.columns else 0

        def _clean_td(v):
            if v is None:
                return None
            s = str(v)
            if s.startswith("0 days "):
                s = s[7:]
            return s

        ft_str = _clean_td(fastest_time)
        alt_str = _clean_td(avg_lap) if pd.notna(avg_lap) and avg_lap.total_seconds() > 0 else None

        entry = {
            "position": position,
            "fastest_lap": ft_str,
            "avg_lap_time": alt_str,
            "pit_stops": pit_stops,
            "laps_led": laps_led,
        }

        if session_type == "Q":
            best_all = session.laps.pick_fastest()
            if not fastest.empty and not best_all.empty:
                gap = fastest["LapTime"] - best_all["LapTime"]
                entry["gap_to_pole"] = _clean_td(gap) if pd.notna(gap) and gap.total_seconds() != 0 else None

        stats[code] = entry

    weather = None
    try:
        w = session.weather_data
        if w is not None and not w.empty:
            weather = {
                "air_temp": round(float(w["AirTemp"].mean()), 1),
                "track_temp": round(float(w["TrackTemp"].mean()), 1),
                "humidity": round(float(w["Humidity"].mean()), 1),
            }
    except Exception:
        pass

    return {
        "type": "driver",
        "entities": driver_codes,
        "scope": {"mode": "race", "circuit": circuit, "year": year, "session": session_type},
        "stats": stats,
        "weather": weather,
        "chart": None,
    }


def compare_constructors(
    constructor_slugs: list[str],
    circuit: str | None = None,
    year: int | None = None,
    session_type: str = "R",
) -> dict:
    """
    Compare N constructors. Aggregates their drivers' stats.
    If circuit is None: returns constructor career stats.
    """
    from backend.services.validator import validate_constructor

    if circuit is None or year is None:
        # Constructor career: sum points/wins across years
        ergast = Ergast()
        result = {}
        for slug in constructor_slugs:
            info = validate_constructor(slug)
            name = info["full_name"]
            total_points = 0
            total_wins = 0
            total_seasons = 0
            best_pos = 99
            years_data = []

            for y in SEASONS:
                try:
                    standings = ergast.get_constructor_standings(y)
                    time.sleep(0.3)
                except Exception:
                    continue
                if not standings or not standings.content:
                    continue

                try:
                    df = standings.content[0]
                    row = df[df["constructorName"].str.lower() == name.lower()]
                    if row.empty:
                        continue

                    r = row.iloc[0]
                    pos = int(r["position"])
                    pts = float(r["points"])
                    wins = int(r["wins"])
                except (ValueError, KeyError, IndexError):
                    continue

                total_points += pts
                total_wins += wins
                total_seasons += 1
                best_pos = min(best_pos, pos)

                years_data.append({
                    "year": y,
                    "position": pos,
                    "points": pts,
                    "wins": wins,
                })

            result[slug] = {
                "full_name": name,
                "seasons": total_seasons,
                "total_points": total_points,
                "total_wins": total_wins,
                "best_championship": best_pos,
                "per_season": years_data,
            }

        return {
            "type": "constructor",
            "entities": constructor_slugs,
            "scope": {"circuit": None, "year": None, "session": None},
            "stats": result,
            "chart": None,
        }

    # Session-level constructor comparison
    # Get each constructor's drivers for that year, aggregate their session stats
    from backend.services.validator import get_drivers_for_year, validate_constructor, validate_driver

    results = {}
    for slug in constructor_slugs:
        info = validate_constructor(slug, year)
        team_drivers = info["drivers"]
        if not team_drivers:
            results[slug] = {"error": "No drivers for this constructor in year"}
            continue

        # Compare the constructor's drivers at this session
        session_stats = compare_drivers(team_drivers, circuit, year, session_type)
        results[slug] = {
            "full_name": info["full_name"],
            "drivers": team_drivers,
            "stats": session_stats["stats"],
        }

    return {
        "type": "constructor",
        "entities": constructor_slugs,
        "scope": {"circuit": circuit, "year": year, "session": session_type},
        "stats": results,
    }


def race_results(
    circuit: str,
    year: int,
    session_type: str = "R",
) -> dict:
    """Full classification for a race or qualifying session."""
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=False, weather=True, messages=False)

    results_list = []
    for drv in session.drivers:
        try:
            info = session.get_driver(drv)
            code = info["Abbreviation"]

            if session.results is None or session.results.empty:
                continue
            row = session.results[session.results["Abbreviation"] == code]
            if row.empty:
                continue

            r = row.iloc[0]
            pos_val = r.get("Position")
            try:
                position = int(pos_val)
            except (ValueError, TypeError):
                position = 0

            entry = {
                "position": position,
                "code": code,
                "full_name": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                "team": info.get("TeamName", ""),
            }

            if session_type == "R":
                try:
                    entry["laps"] = int(r.get("Laps", 0))
                except (ValueError, TypeError):
                    entry["laps"] = 0
                entry["status"] = r.get("Status", "Finished")
                entry["time"] = r.get("Time", None)
                gap = r.get("GapToLeader", None)
                entry["gap"] = str(gap) if pd.notna(gap) else None
                grid = r.get("GridPosition", None)
                try:
                    entry["grid"] = int(grid) if pd.notna(grid) else None
                except (ValueError, TypeError):
                    entry["grid"] = None
                entry["positions_gained"] = (entry["grid"] - entry["position"]) if entry["grid"] else None

            if session_type == "Q":
                for q in ("Q1", "Q2", "Q3"):
                    val = r.get(q, None)
                    entry[q.lower()] = str(val) if pd.notna(val) else None
                if not session.results.empty:
                    pole = session.results.iloc[0]
                    if pole.get("Q3") and r.get("Q3"):
                        gap = r["Q3"] - pole["Q3"]
                        entry["gap_to_pole"] = str(gap) if pd.notna(gap) else None
        except Exception:
            continue

        results_list.append(entry)

    results_list.sort(key=lambda x: x["position"])

    def _clean_td(v):
        if v is None:
            return None
        s = str(v)
        if s.startswith("0 days "):
            s = s[7:]
        return s

    # Fastest lap
    fastest = None
    if session_type == "R":
        fastest_lap = session.laps.pick_fastest()
        if not fastest_lap.empty:
            fastest = {
                "code": fastest_lap["Driver"],
                "time": _clean_td(fastest_lap["LapTime"]),
                "lap": int(fastest_lap["LapNumber"]),
            }

    # DNFs
    dnfs = [e["code"] for e in results_list if e.get("status") != "Finished"]

    # Weather
    weather = None
    try:
        w = session.weather_data
        if w is not None and not w.empty:
            weather = {
                "air_temp": round(float(w["AirTemp"].mean()), 1),
                "track_temp": round(float(w["TrackTemp"].mean()), 1),
                "humidity": round(float(w["Humidity"].mean()), 1),
            }
    except Exception:
        pass

    return {
        "circuit": circuit,
        "year": year,
        "session": session_type,
        "results": results_list,
        "fastest_lap": fastest,
        "dnfs": dnfs,
        "weather": weather,
    }
