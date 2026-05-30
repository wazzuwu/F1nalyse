"""
Position change service — position of each driver at the end of each lap.
Returns Plotly-compatible chart data with FastF1 driver colours.
"""

import fastf1
import fastf1.plotting
import numpy as np

from backend.config import FASTF1_CACHE_DIR
from backend.services.fastf1_analyzer import _event_name

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))


def position_changes(circuit: str, year: int, session_type: str = "R", driver: str | None = None) -> dict:
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=False, weather=False, messages=False)

    data = []
    seen_drivers = []

    drivers_to_process = [driver] if driver else session.drivers

    for drv in drivers_to_process:
        drv_laps = session.laps.pick_drivers(drv)
        if drv_laps.empty:
            continue

        abb = drv_laps["Driver"].iloc[0]
        style = fastf1.plotting.get_driver_style(
            identifier=abb, style=["color", "linestyle"], session=session
        )

        lap_numbers = drv_laps["LapNumber"].astype(int).tolist()
        positions = drv_laps["Position"].astype(float).tolist()

        if not lap_numbers:
            continue

        color = style.get("color", "#888888")
        linestyle = style.get("linestyle", "solid")

        data.append({
            "driver": abb,
            "color": color,
            "linestyle": linestyle,
            "lap_numbers": lap_numbers,
            "positions": positions,
        })
        seen_drivers.append(abb)

    # Build Plotly traces
    traces = []
    for d in data:
        traces.append({
            "x": d["lap_numbers"],
            "y": d["positions"],
            "type": "scatter",
            "mode": "lines+markers",
            "name": d["driver"],
            "line": {
                "color": d["color"],
                "width": 2,
                "dash": d["linestyle"] if d["linestyle"] != "solid" else None,
            },
            "marker": {"size": 4, "color": d["color"]},
            "hovertemplate": f"%{{x}} laps<br>P%{{y}}<br>{d['driver']}<extra></extra>",
        })

    # Determine max lap count across all drivers
    max_laps = 0
    for d in data:
        if d["lap_numbers"]:
            max_laps = max(max_laps, max(d["lap_numbers"]))

    max_pos = 22

    chart = {
        "type": "position_chart",
        "data": traces,
        "layout": {
            "title": {
                "text": f"Position Changes — {session.event['EventName']} {year}",
                "font": {"color": "#ffffff", "size": 16},
                "x": 0.5,
            },
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
            "xaxis": {
                "title": {"text": "Lap", "font": {"color": "#ffffff"}},
                "tickfont": {"color": "#ffffff"},
                "gridcolor": "rgba(255,255,255,0.08)",
                "range": [0.5, max_laps + 0.5],
                "fixedrange": True,
            },
            "yaxis": {
                "title": {"text": "Position", "font": {"color": "#ffffff"}},
                "tickfont": {"color": "#ffffff"},
                "gridcolor": "rgba(255,255,255,0.08)",
                "autorange": "reversed",
                "dtick": 1,
                "range": [max_pos + 0.5, 0.5],
                "fixedrange": True,
            },
            "legend": {
                "x": 1.02,
                "y": 1,
                "bgcolor": "rgba(0,0,0,0)",
                "font": {"color": "#ffffff", "size": 10},
                "itemclick": False,
                "itemdoubleclick": False,
            },
            "margin": {"l": 50, "r": 140, "t": 50, "b": 50},
            "hovermode": "closest",
            "dragmode": False,
        },
    }

    return {
        "circuit": circuit,
        "year": year,
        "session": session_type,
        "drivers": seen_drivers,
        "chart": chart,
    }
