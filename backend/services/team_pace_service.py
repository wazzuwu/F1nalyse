"""
Team pace comparison — boxplot of lap times per team (or per driver if single team selected).
Uses FastF1 team colours and quick laps (within 107% of fastest).
"""

import fastf1
import fastf1.plotting
import numpy as np

from backend.config import FASTF1_CACHE_DIR
from backend.services.fastf1_analyzer import _event_name

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))


def _hex_to_rgba(hex_color: str, alpha: float = 1.0) -> str:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        return f"rgba(128,128,128,{alpha})"
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def team_pace(circuit: str, year: int, session_type: str = "R", driver: str | None = None) -> dict:
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=False, weather=False, messages=False)

    laps = session.laps.pick_quicklaps()
    if laps.empty:
        laps = session.laps

    transformed = laps.copy()
    transformed["LapTime (s)"] = transformed["LapTime"].dt.total_seconds()

    # Filter outliers (laps slower than 150% of median)
    median_time = transformed["LapTime (s)"].median()
    transformed = transformed[transformed["LapTime (s)"] < median_time * 1.5]

    if driver:
        # Get the driver's team, then show both drivers of that team
        drv_laps = session.laps.pick_drivers(driver)
        if drv_laps.empty:
            return {"error": f"Driver {driver} not found in session"}
        drv_team = drv_laps["Team"].iloc[0]
        team_laps = transformed[transformed["Team"] == drv_team]
        grouping_col = "Driver"
        order = sorted(team_laps[grouping_col].unique())
        title_suffix = f"{drv_team}"
    else:
        team_laps = transformed
        grouping_col = "Team"
        order = (
            team_laps.groupby("Team")["LapTime (s)"]
            .median()
            .sort_values()
            .index
            .tolist()
        )
        title_suffix = "All Teams"

    # Build colour palette
    palette = {}
    for team in team_laps["Team"].unique():
        palette[team] = fastf1.plotting.get_team_color(team, session=session)

    traces = []
    for group in order:
        subset = team_laps[team_laps[grouping_col] == group]
        times = subset["LapTime (s)"].dropna().tolist()
        if not times:
            continue
        team_name = subset["Team"].iloc[0]
        color = palette.get(team_name, "#888888")
        traces.append({
            "y": times,
            "type": "box",
            "name": group,
            "marker": {"color": color},
            "line": {"color": color},
            "fillcolor": _hex_to_rgba(color, 0.15),
            "boxmean": "sd",
            "whiskerwidth": 0.6,
            "hovertemplate": f"%{{y:.3f}}s<br>{group}<extra></extra>",
        })

    event_name_str = session.event["EventName"]

    chart = {
        "type": "team_pace_chart",
        "data": traces,
        "layout": {
            "title": {
                "text": f"Team Pace — {event_name_str} {year} — {title_suffix}",
                "font": {"color": "#ffffff", "size": 14},
                "x": 0.5,
            },
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
            "xaxis": {
                "title": {"text": ""},
                "tickfont": {"color": "#ffffff", "size": 11},
                "gridcolor": "rgba(255,255,255,0.08)",
                "fixedrange": True,
            },
            "yaxis": {
                "title": {"text": "Lap Time (s)", "font": {"color": "#ffffff"}},
                "tickfont": {"color": "#ffffff"},
                "gridcolor": "rgba(255,255,255,0.08)",
                "fixedrange": True,
            },
            "legend": {"traceorder": "normal", "font": {"color": "#ffffff", "size": 10}},
            "margin": {"l": 60, "r": 30, "t": 50, "b": 80},
            "boxmode": "group",
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
