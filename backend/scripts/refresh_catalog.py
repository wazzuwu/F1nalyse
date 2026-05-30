"""
Build season-aware driver & constructor catalogs from FastF1.

Pre-2018 uses Ergast API (results-based, lightweight).
2018+ uses official F1 API (driver_info, lightweight).
Writes out:
  - backend/data/valid_drivers.json       (per-year team mapping)
  - backend/data/valid_constructors.json   (per-year driver lineup)
  - backend/data/valid_seasons.json        (available years)
  - backend/data/aliases.json              (name -> code, for LLM routing)

Run:
    python -m backend.scripts.refresh_catalog
"""

import json
import sys
import time
from pathlib import Path

import fastf1
from fastf1 import api
from fastf1.ergast import Ergast
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from backend.config import FASTF1_CACHE_DIR, BASE_DIR

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))

F1_API_START = 2018  # Official F1 API supports from here
SEASONS = list(range(2000, 2027))
DATA_DIR = BASE_DIR / "backend" / "data"


def to_slug(name: str) -> str:
    return name.lower().replace(" ", "_").replace("-", "_").replace(".", "").replace("&", "and").replace("'", "").replace("/", "_")


def scan_via_f1_api(year: int, drivers: dict, constructors: dict, constructor_names: dict):
    """Use official F1 API (fast, 2018+)."""
    schedule = fastf1.get_event_schedule(year)

    events = []
    for _, event in schedule.iterrows():
        fmt = event.get("EventFormat", "")
        if fmt == "testing" or "testing" in fmt.lower():
            continue
        if event.get("EventDate") and event["EventDate"] > pd.Timestamp.now():
            continue
        events.append(event)

    if not events:
        return set()

    total = len(events)
    indices = {0}
    if total > 2:
        indices.add(total // 3)
    if total > 3:
        indices.add(2 * total // 3)
    if total > 1:
        indices.add(total - 1)

    sampled = [events[i] for i in sorted(indices)]
    year_drivers = {}

    for event in sampled:
        round_num = event["RoundNumber"]
        event_name = event["EventName"]

        try:
            session = fastf1.get_session(year, round_num, "R")
            path = session.api_path
            driver_data = api.driver_info(path)
        except Exception as e:
            print(f"  [{year}] R{round_num} {event_name}: skipped ({e})")
            continue

        for num, info in driver_data.items():
            code = info.get("Tla", "")
            if not code or code == "?":
                continue
            first = info.get("FirstName", "")
            last = info.get("LastName", "")
            full_name = f"{first} {last}".strip()
            team_name = info.get("TeamName", "")
            team_slug = to_slug(team_name)

            if not full_name or full_name == " ":
                full_name = info.get("FullName", code)

            if code not in drivers:
                drivers[code] = {
                    "full_name": full_name,
                    "teams": {},
                    "_driver_seasons": {},
                    "_name_map": {},
                    "_year_driver": {},
                }

            drivers[code]["teams"][str(year)] = team_slug
            year_drivers[code] = team_slug
            constructor_names[team_slug] = team_name

            drv_num = info.get("RacingNumber", "")
            identity = f"f1api_{drv_num}"
            prev = drivers[code]["_driver_seasons"].get(identity, 0)
            drivers[code]["_driver_seasons"][identity] = prev + 1
            drivers[code]["_name_map"][identity] = full_name
            drivers[code]["_year_driver"][str(year)] = identity

    return year_drivers


def scan_via_ergast(year: int, drivers: dict, constructors: dict, constructor_names: dict):
    ergast = Ergast()

    try:
        schedule = ergast.get_race_schedule(year)
        time.sleep(0.5)
    except Exception as e:
        print(f"  [{year}] schedule failed: {e}")
        return {}

    if schedule.empty:
        return {}

    race_rounds = sorted(schedule["round"].unique())
    if not len(race_rounds):
        return {}

    total = len(race_rounds)
    idxs = {0}
    if total > 2:
        idxs.add(total // 3)
    if total > 3:
        idxs.add(2 * total // 3)
    if total > 1:
        idxs.add(total - 1)

    sampled_rounds = sorted(int(race_rounds[i]) for i in idxs)
    year_drivers = {}

    for rnd in sampled_rounds:
        try:
            result = ergast.get_race_results(year, rnd)
            time.sleep(0.5)
        except Exception as e:
            print(f"  [{year}] R{rnd}: skipped ({e})")
            time.sleep(1)
            continue

        if not result or not result.content:
            continue

        for race_frame in result.content:
            for i in range(len(race_frame)):
                row = race_frame.iloc[i]
                code = row.get("driverCode", "")
                if not code or code == "?":
                    continue
                driver_id = row.get("driverId", "")
                first = row.get("givenName", "")
                last = row.get("familyName", "")
                team_name = row.get("constructorName", "")
                full_name = f"{first} {last}".strip()
                team_slug = to_slug(team_name)

                if code not in drivers:
                    drivers[code] = {
                        "full_name": full_name,
                        "teams": {},
                        "_driver_seasons": {},
                        "_name_map": {},
                        "_year_driver": {},
                    }

                prev = drivers[code]["_driver_seasons"].get(driver_id, 0)
                drivers[code]["_driver_seasons"][driver_id] = prev + 1
                drivers[code]["_name_map"][driver_id] = full_name
                drivers[code]["_year_driver"][str(year)] = driver_id

                drivers[code]["teams"][str(year)] = team_slug
                year_drivers[code] = team_slug
                constructor_names[team_slug] = team_name

    return year_drivers


def build():
    drivers = {}
    constructors = {}
    constructor_names = {}
    aliases = {}

    for year in SEASONS:
        print(f"[{year}] Scanning...")

        if year >= F1_API_START:
            year_drivers = scan_via_f1_api(year, drivers, constructors, constructor_names)
        else:
            year_drivers = scan_via_ergast(year, drivers, constructors, constructor_names)

        for code, team_slug in year_drivers.items():
            if team_slug not in constructors:
                constructors[team_slug] = {"drivers": {}}
            if str(year) not in constructors[team_slug]["drivers"]:
                constructors[team_slug]["drivers"][str(year)] = []
            if code not in constructors[team_slug]["drivers"][str(year)]:
                constructors[team_slug]["drivers"][str(year)].append(code)

        print(f"  => {len(year_drivers)} drivers")

    for slug, name in constructor_names.items():
        if slug in constructors:
            constructors[slug]["full_name"] = name

    # Resolve code conflicts: if a single code maps to multiple drivers
    # (e.g. MSC = Michael + Mick, VER = Vergne + Verstappen), keep only the
    # driver with the most seasons. The eliminated driver's years are removed.
    for code, data in drivers.items():
        seasons = data.pop("_driver_seasons", {})
        name_map = data.pop("_name_map", {})
        year_driver = data.pop("_year_driver", {})

        if len(seasons) > 1:
            # Group identities by name to handle same-driver-with-different-numbers
            name_groups = {}
            for sid, count in seasons.items():
                name = name_map.get(sid, data["full_name"])
                name_groups.setdefault(name, {"ids": set(), "total": 0})
                name_groups[name]["ids"].add(sid)
                name_groups[name]["total"] += count

            best_name = max(name_groups, key=lambda n: name_groups[n]["total"])
            best_ids = name_groups[best_name]["ids"]
            data["full_name"] = best_name
            data["teams"] = {
                y: t for y, t in data["teams"].items()
                if year_driver.get(y) in best_ids
            }

    # Build aliases: last names + unique first names only
    first_counts = {}
    last_map = {}
    for code, data in drivers.items():
        parts = data["full_name"].lower().split()
        if len(parts) >= 2:
            first_counts[parts[0]] = first_counts.get(parts[0], 0) + 1
            last_map[parts[-1]] = code

    for code, data in drivers.items():
        parts = data["full_name"].lower().split()
        for part in parts:
            if part in aliases:
                continue
            if part in last_map and last_map[part] == code:
                aliases[part] = code
            elif len(parts) >= 2 and part == parts[0] and first_counts.get(part, 0) == 1:
                aliases[part] = code

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with open(DATA_DIR / "valid_drivers.json", "w", encoding="utf-8") as f:
        json.dump(drivers, f, indent=2, ensure_ascii=False)

    with open(DATA_DIR / "valid_constructors.json", "w", encoding="utf-8") as f:
        json.dump(constructors, f, indent=2, ensure_ascii=False)

    with open(DATA_DIR / "valid_seasons.json", "w", encoding="utf-8") as f:
        json.dump(SEASONS, f, indent=2)

    with open(DATA_DIR / "aliases.json", "w", encoding="utf-8") as f:
        json.dump(aliases, f, indent=2, ensure_ascii=False)

    print(f"\nDone: {len(drivers)} drivers, {len(constructors)} constructors, {len(aliases)} aliases across {len(SEASONS)} seasons ({SEASONS[0]}-{SEASONS[-1]})")


if __name__ == "__main__":
    build()
