"""
Tyre strategy service — horizontal bar chart of each driver's stint lengths and compounds.
Uses FastF1 compound colours and groups by driver.
"""

import fastf1
import fastf1.plotting

from backend.config import FASTF1_CACHE_DIR
from backend.services.fastf1_analyzer import _event_name

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))

_COMPOUND_ORDER = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET", "UNKNOWN"]


def tyre_strategies(circuit: str, year: int, session_type: str = "R", driver: str | None = None) -> dict:
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=False, weather=False, messages=False)

    laps = session.laps
    drivers: list[str] = session.drivers
    driver_abbs = [session.get_driver(d)["Abbreviation"] for d in drivers]

    if driver:
        driver_abbs = [d for d in driver_abbs if d == driver]
        if not driver_abbs:
            return {"error": f"Driver {driver} not found in session"}

    stints = laps[["Driver", "Stint", "Compound", "LapNumber"]].copy()
    stints = stints.groupby(["Driver", "Stint", "Compound"]).count().reset_index()
    stints = stints.rename(columns={"LapNumber": "StintLength"})

    # Build traces — one per stint segment
    traces = []
    seen_compounds: set[str] = set()
    driver_order = list(driver_abbs)

    for abb in driver_order:
        driver_stints = stints[stints["Driver"] == abb]
        stint_start = 0

        for _, row in driver_stints.iterrows():
            compound = str(row["Compound"]).upper()
            stint_len = int(row["StintLength"])
            if stint_len == 0:
                continue

            compound_color = fastf1.plotting.get_compound_color(compound, session=session)
            seen_compounds.add(compound)

            traces.append({
                "type": "bar",
                "orientation": "h",
                "y": [abb],
                "x": [stint_len],
                "base": stint_start,
                "marker": {"color": compound_color, "line": {"color": "rgba(0,0,0,0.3)", "width": 0.5}},
                "name": compound,
                "legendgroup": compound,
                "showlegend": compound not in [t.get("name") for t in traces],
                "hovertemplate": f"{abb}<br>{compound}<br>Lap {stint_start}-{stint_start + stint_len}<br>{stint_len} laps<extra></extra>",
            })
            stint_start += stint_len

    event_name_str = session.event["EventName"]

    chart = {
        "type": "tyre_strategies_chart",
        "data": traces,
        "layout": {
            "title": {
                "text": f"Tyre Strategies — {event_name_str} {year}",
                "font": {"color": "#ffffff", "size": 14},
                "x": 0.5,
            },
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
            "barmode": "stack",
            "bargap": 0.3,
            "xaxis": {
                "title": {"text": "Lap", "font": {"color": "#ffffff"}},
                "tickfont": {"color": "#ffffff"},
                "gridcolor": "rgba(255,255,255,0.08)",
                "fixedrange": True,
            },
            "yaxis": {
                "title": {"text": ""},
                "tickfont": {"color": "#ffffff", "size": 11},
                "gridcolor": "rgba(255,255,255,0.08)",
                "autorange": "reversed",
                "fixedrange": True,
            },
            "legend": {
                "orientation": "h",
                "y": -0.15,
                "x": 0.5,
                "xanchor": "center",
                "bgcolor": "rgba(0,0,0,0)",
                "font": {"color": "#ffffff", "size": 11},
            },
            "margin": {"l": 60, "r": 20, "t": 50, "b": 80},
            "hovermode": "closest",
            "dragmode": False,
        },
    }

    return {
        "circuit": circuit,
        "year": year,
        "session": session_type,
        "driver": driver,
        "chart": chart,
    }
