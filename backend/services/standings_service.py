"""
Standings service — driver and constructor standings for a season,
optionally after a specific round.
"""

import fastf1
from fastf1.ergast import Ergast

from backend.config import FASTF1_CACHE_DIR
from backend.services.fastf1_analyzer import SEASONS

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))


def driver_standings(year: int, after_round: int | None = None) -> list[dict]:
    ergast = Ergast()
    try:
        if after_round is not None:
            resp = ergast.get_driver_standings(year, round=after_round)
        else:
            resp = ergast.get_driver_standings(year)
    except Exception:
        return []
    if not resp or not resp.content:
        return []

    df = resp.content[0]
    out = []
    for _, r in df.iterrows():
        try:
            team = r["constructorNames"][0] if r.get("constructorNames") else None
        except (IndexError, KeyError):
            team = None
        try:
            out.append({
                "position": int(r["position"]),
                "code": r["driverCode"],
                "full_name": f"{r.get('givenName', '')} {r.get('familyName', '')}".strip(),
                "team": team,
                "points": float(r["points"]),
                "wins": int(r["wins"]),
            })
        except (ValueError, KeyError):
            continue
    return out


def constructor_standings(year: int, after_round: int | None = None) -> list[dict]:
    ergast = Ergast()
    try:
        if after_round is not None:
            resp = ergast.get_constructor_standings(year, round=after_round)
        else:
            resp = ergast.get_constructor_standings(year)
    except Exception:
        return []
    if not resp or not resp.content:
        return []

    df = resp.content[0]
    out = []
    for _, r in df.iterrows():
        try:
            out.append({
                "position": int(r["position"]),
                "id": r["constructorName"].lower().replace(" ", "_"),
                "full_name": r["constructorName"],
                "points": float(r["points"]),
                "wins": int(r["wins"]),
            })
        except (ValueError, KeyError):
            continue
    return out
