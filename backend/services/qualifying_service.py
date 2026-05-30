"""
Qualifying results service — horizontal bar chart of qualifying time deltas to pole.
Uses FastF1 team colours and displays fastest lap time in the title.
"""

import fastf1
import fastf1.plotting
import pandas as pd
from fastf1.core import Laps

from backend.config import FASTF1_CACHE_DIR
from backend.services.fastf1_analyzer import _event_name

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))


def _seconds_from_timedelta(td) -> float:
    """Convert pandas Timedelta to total seconds."""
    if pd.isna(td):
        return 0.0
    return td.total_seconds()


def qualifying_results(circuit: str, year: int, session_type: str = "Q", driver: str | None = None) -> dict:
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=False, weather=False, messages=False)

    drivers = pd.unique(session.laps["Driver"])
    if driver:
        drivers = [d for d in drivers if d == driver]
        if not drivers:
            return {"error": f"Driver {driver} not found in session"}

    list_fastest_laps = []
    for drv in drivers:
        drv_laps = session.laps.pick_drivers(drv)
        if drv_laps.empty:
            continue
        fastest = drv_laps.pick_fastest()
        if fastest.empty:
            continue
        list_fastest_laps.append(fastest)

    if not list_fastest_laps:
        return {"error": "No qualifying laps found"}

    fastest_laps = Laps(list_fastest_laps).sort_values(by="LapTime").reset_index(drop=True)
    pole_lap = fastest_laps.pick_fastest()
    fastest_laps["LapTimeDelta"] = fastest_laps["LapTime"] - pole_lap["LapTime"]
    fastest_laps["LapTimeDeltaSeconds"] = fastest_laps["LapTimeDelta"].apply(_seconds_from_timedelta)

    # Team colours per driver
    team_colours = {}
    for _, lap in fastest_laps.iterlaps():
        team = lap["Team"]
        if team not in team_colours:
            team_colours[team] = fastf1.plotting.get_team_color(team, session=session)

    driver_colours = []
    driver_labels = []
    time_deltas = []
    for _, lap in fastest_laps.iterlaps():
        driver_labels.append(lap["Driver"])
        time_deltas.append(_seconds_from_timedelta(lap["LapTimeDelta"]))
        driver_colours.append(team_colours.get(lap["Team"], "#888888"))

    pole_time_s = _seconds_from_timedelta(pole_lap["LapTime"])
    pole_min = int(pole_time_s // 60)
    pole_sec = pole_time_s - pole_min * 60
    pole_time_str = f"{pole_min}:{pole_sec:06.3f}"
    pole_driver = pole_lap["Driver"]

    traces = [
        {
            "y": list(range(len(driver_labels))),
            "x": time_deltas,
            "type": "bar",
            "orientation": "h",
            "marker": {"color": driver_colours, "line": {"color": "rgba(0,0,0,0.3)", "width": 0.5}},
            "text": [f"+{t:.3f}s" if t > 0 else "Pole" for t in time_deltas],
            "textposition": "outside",
            "textfont": {"color": "#ffffff", "size": 10},
            "hovertemplate": "%{y}<br>+%{x:.3f}s<extra></extra>",
            "showlegend": False,
        }
    ]

    # Custom y-axis labels
    tickvals = list(range(len(driver_labels)))
    ticktext = driver_labels

    chart = {
        "type": "qualifying_chart",
        "data": traces,
        "layout": {
            "title": {
                "text": f"{session.event['EventName']} {year} Qualifying<br><sub>Fastest Lap: {pole_time_str} ({pole_driver})</sub>",
                "font": {"color": "#ffffff", "size": 14},
                "x": 0.5,
            },
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
            "xaxis": {
                "title": {"text": "Gap to Pole (s)", "font": {"color": "#ffffff"}},
                "tickfont": {"color": "#ffffff"},
                "gridcolor": "rgba(255,255,255,0.08)",
                "zeroline": True,
                "zerolinecolor": "rgba(255,255,255,0.15)",
                "fixedrange": True,
            },
            "yaxis": {
                "tickvals": tickvals,
                "ticktext": ticktext,
                "tickfont": {"color": "#ffffff", "size": 11},
                "gridcolor": "rgba(255,255,255,0.08)",
                "autorange": "reversed",
                "fixedrange": True,
            },
            "margin": {"l": 50, "r": 80, "t": 70, "b": 50},
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
