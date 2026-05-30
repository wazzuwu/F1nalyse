"""
Telemetry service — single-driver lap deep-dive with Plotly chart generation.
"""

import fastf1
import pandas as pd

from backend.config import FASTF1_CACHE_DIR
from backend.services.fastf1_analyzer import _event_name

fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))


_METRIC_LABELS = {
    "speed": ("Speed", "Speed (km/h)", "#1f77b4"),
    "throttle": ("Throttle", "Throttle (%)", "#2ca02c"),
    "brake": ("Brake", "Brake (%)", "#d62728"),
    "gear": ("nGear", "Gear", "#9467bd"),
    "rpm": ("RPM", "RPM", "#ff7f0e"),
    "drs": ("DRS", "DRS (0/1)", "#8c564b"),
}


def _load_lap(driver: str, circuit: str, year: int, session_type: str, lap_number: int | None):
    """Load a single driver's lap telemetry."""
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=True, weather=False, messages=False)

    laps = session.laps.pick_drivers([driver])
    if laps.empty:
        return None, None, None

    if lap_number is not None:
        target = laps[laps["LapNumber"] == lap_number]
        if target.empty:
            return None, None, None
        lap = target.iloc[0]
    else:
        fastest = laps.pick_fastest()
        if fastest.empty:
            return None, None, None
        lap = fastest

    try:
        telemetry = lap.get_telemetry()
    except Exception:
        telemetry = None
    return session, lap, telemetry


def _make_chart(telemetry: pd.DataFrame, metric: str) -> dict:
    col, label, color = _METRIC_LABELS.get(metric, ("Speed", "Speed (km/h)", "#1f77b4"))
    if col not in telemetry.columns:
        return {"type": metric, "data": []}

    return {
        "type": f"{metric}_trace",
        "data": [
            {
                "x": telemetry["Distance"].tolist(),
                "y": telemetry[col].tolist(),
                "type": "scatter",
                "mode": "lines",
                "name": label,
                "line": {"color": color, "width": 2},
                "hovertemplate": f"Distance: %{{x:.0f}}m<br>{label}: %{{y:.1f}}<extra></extra>",
            }
        ],
        "layout": {
            "title": {"text": f"{label} vs Distance"},
            "xaxis": {"title": "Distance (m)"},
            "yaxis": {"title": label},
            "margin": {"t": 40, "r": 20, "b": 40, "l": 60},
            "template": "plotly_dark",
        },
    }


def _stats(telemetry: pd.DataFrame) -> dict:
    def _safe(col: str, agg: str, default=0.0) -> float:
        if col not in telemetry.columns or telemetry[col].dropna().empty:
            return default
        return round(float(getattr(telemetry[col], agg)()), 1)

    return {
        "avg_speed": _safe("Speed", "mean"),
        "top_speed": _safe("Speed", "max"),
        "min_speed": _safe("Speed", "min"),
        "avg_throttle": _safe("Throttle", "mean"),
        "avg_brake": _safe("Brake", "mean"),
    }


def _interpolate_color(t: float, scale: list) -> str:
    """Interpolate hex color from a [[pos, hex], ...] scale at normalized t."""
    for i in range(len(scale) - 1):
        p0, c0 = scale[i]
        p1, c1 = scale[i + 1]
        if p0 <= t <= p1:
            local = (t - p0) / (p1 - p0) if p1 != p0 else 0
            r0, g0, b0 = int(c0[1:3], 16), int(c0[3:5], 16), int(c0[5:7], 16)
            r1, g1, b1 = int(c1[1:3], 16), int(c1[3:5], 16), int(c1[5:7], 16)
            r = int(r0 + (r1 - r0) * local)
            g = int(g0 + (g1 - g0) * local)
            b = int(b0 + (b1 - b0) * local)
            return f"rgb({r},{g},{b})"
    return scale[-1][1]


def _speed_track_chart(telemetry: pd.DataFrame) -> dict | None:
    """Build a speed-colored circuit track map (colormap on X/Y layout).
    
    Uses segment-grouping (consecutive pairs grouped by speed bin) for
    reliable rendering with regular scatter traces.
    """
    if "X" not in telemetry.columns or "Y" not in telemetry.columns or "Speed" not in telemetry.columns:
        return None
    x_arr = telemetry["X"].values
    y_arr = telemetry["Y"].values
    speed_arr = telemetry["Speed"].values
    speed_min = float(speed_arr.min())
    speed_max = float(speed_arr.max())

    x_full = [float(v) for v in x_arr]
    y_full = [float(v) for v in y_arr]

    # Bright dark-background-optimized colorscale (Turbo-like)
    colorscale = [
        (0.00, "#440154"),
        (0.15, "#3b528b"),
        (0.30, "#21918c"),
        (0.45, "#5ec962"),
        (0.65, "#fde725"),
        (0.80, "#fca50a"),
        (1.00, "#ff4d4d"),
    ]

    # Group consecutive segment-pairs by speed bin (12 bins for performance)
    N_BINS = 12
    bins: dict[int, list[tuple[float, float]]] = {i: [] for i in range(N_BINS)}
    for i in range(len(x_arr) - 1):
        t = (float(speed_arr[i]) - speed_min) / (speed_max - speed_min) if speed_max > speed_min else 0
        bin_idx = min(int(t * N_BINS), N_BINS - 1)
        bins[bin_idx].append((float(x_arr[i]), float(y_arr[i])))
        bins[bin_idx].append((float(x_arr[i + 1]), float(y_arr[i + 1])))
        bins[bin_idx].append((None, None))

    traces = []
    # Background track outline
    traces.append({
        "x": x_full, "y": y_full,
        "type": "scatter", "mode": "lines",
        "line": {"color": "rgba(255,255,255,0.1)", "width": 12},
        "showlegend": False, "hoverinfo": "none",
    })
    # Speed-colored segments by bin
    for bin_idx in range(N_BINS):
        pts = bins[bin_idx]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        if not xs:
            continue
        t_center = (bin_idx + 0.5) / N_BINS
        color = _interpolate_color(t_center, colorscale)
        traces.append({
            "x": xs, "y": ys,
            "type": "scatter", "mode": "lines",
            "line": {"color": color, "width": 5},
            "connectgaps": False,
            "showlegend": False, "hoverinfo": "none",
        })
    # Dummy trace for the colorbar
    traces.append({
        "x": [None, None], "y": [None, None],
        "type": "scatter", "mode": "markers",
        "marker": {
            "color": [speed_min, speed_max],
            "colorscale": [[p / 1.0, c] for p, c in colorscale],
            "colorbar": {
                "title": {"text": "Speed (km/h)", "side": "right"},
                "x": 1.02, "len": 0.4, "thickness": 14,
            },
            "size": 0,
            "cmin": speed_min, "cmax": speed_max,
        },
        "showlegend": False, "hoverinfo": "none",
    })
    # Invisible hover anchor
    traces.append({
        "x": x_full, "y": y_full,
        "type": "scatter", "mode": "markers",
        "marker": {"opacity": 0, "size": 5},
        "showlegend": False, "hoverinfo": "none", "name": "_hover",
    })

    return {
        "type": "speed_track",
        "data": traces,
        "layout": {
            "xaxis": {"visible": False, "autorange": True, "scaleanchor": "y", "scaleratio": 1, "constrain": "domain"},
            "yaxis": {"visible": False, "autorange": True, "constrain": "domain"},
            "margin": {"t": 10, "r": 60, "b": 10, "l": 10},
            "template": "plotly_dark",
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
            "hovermode": "closest",
            "hoverdistance": 20,
            "spikedistance": 20,
        },
    }


def single_lap_telemetry(
    driver: str,
    circuit: str,
    year: int,
    session_type: str = "R",
    lap_number: int | None = None,
    metric: str = "speed",
) -> dict:
    session, lap, telemetry = _load_lap(driver, circuit, year, session_type, lap_number)
    if lap is None:
        return {"error": f"No lap data for {driver} at {circuit} {year}"}

    is_fastest = lap_number is None

    response = {
        "driver": driver,
        "circuit": circuit,
        "lap": {
            "number": int(lap["LapNumber"]),
            "time": str(lap["LapTime"]),
            "is_fastest": is_fastest,
        },
        "stats": _stats(telemetry) if telemetry is not None else {},
        "telemetry": None,
        "chart": _make_chart(telemetry, metric) if telemetry is not None else None,
        "track_chart": _speed_track_chart(telemetry) if telemetry is not None else None,
    }

    # Return telemetry as array only when explicitly requested
    if metric == "all":
        response["telemetry"] = telemetry.to_dict(orient="records")

    return response


def multi_driver_telemetry(
    drivers: list[str],
    circuit: str,
    year: int,
    session_type: str = "R",
    lap_number: int | None = None,
    metric: str = "speed",
) -> dict:
    """
    Compare multiple drivers' fastest (or specified) lap telemetry.
    Returns overlaid speed traces with team colors as a Plotly chart.
    """
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=True, weather=False, messages=False)

    col, metric_label, _ = _METRIC_LABELS.get(metric, ("Speed", "Speed (km/h)", "#1f77b4"))

    traces = []
    driver_data = []

    try:
        team_colors_cache = {}
        for drv in drivers:
            laps = session.laps.pick_drivers([drv])
            if laps.empty:
                driver_data.append({"code": drv, "error": "No laps found"})
                continue

            if lap_number is not None:
                target = laps[laps["LapNumber"] == lap_number]
                if target.empty:
                    driver_data.append({"code": drv, "error": f"Lap {lap_number} not found"})
                    continue
                lap = target.iloc[0]
            else:
                fastest = laps.pick_fastest()
                if fastest.empty:
                    driver_data.append({"code": drv, "error": "No fastest lap"})
                    continue
                lap = fastest

            try:
                tel = lap.get_telemetry().add_distance()
            except Exception:
                driver_data.append({"code": drv, "error": "No telemetry data"})
                continue

            if col not in tel.columns or tel[col].dropna().empty:
                driver_data.append({"code": drv, "error": f"No {metric} data"})
                continue

            try:
                color = fastf1.plotting.get_team_color(drv, session=session)
            except Exception:
                try:
                    team_name = str(lap.get("Team", ""))
                    color = fastf1.plotting.get_team_color(team_name, session=session)
                except Exception:
                    fallback = ["#e10600", "#00d2be", "#ffe800", "#0058f8", "#f58020",
                                "#04c4f4", "#a6a6a6", "#00a35c", "#b12b9b", "#1e41ff"]
                    idx = len([d for d in driver_data if "error" not in d])
                    color = fallback[idx % len(fallback)]

            team_name = str(lap.get("Team", ""))

            lap_time = lap["LapTime"]
            ft_str = str(lap_time) if pd.notna(lap_time) else None
            if ft_str and ft_str.startswith("0 days "):
                ft_str = ft_str[7:]

            driver_data.append({
                "code": drv,
                "team": team_name,
                "color": color,
                "lap_number": int(lap["LapNumber"]),
                "lap_time": ft_str,
                "is_fastest": lap_number is None,
                "stats": {
                    "avg_speed": round(float(tel["Speed"].mean()), 1),
                    "top_speed": round(float(tel["Speed"].max()), 1),
                    "min_speed": round(float(tel["Speed"].min()), 1),
                    "avg_throttle": round(float(tel["Throttle"].mean()), 1),
                    "avg_brake": round(float(tel["Brake"].mean()), 1),
                },
            })

            traces.append({
                "x": tel["Distance"].tolist(),
                "y": tel[col].tolist(),
                "type": "scatter",
                "mode": "lines",
                "name": drv,
                "line": {"color": color, "width": 2},
                "hovertemplate": f"Distance: %{{x:.0f}}m<br>{metric_label}: %{{y:.1f}}<extra></extra>",
            })

    except Exception as e:
        return {"error": str(e)}

    chart = None
    if traces:
        chart = {
            "type": f"{metric}_multi",
            "data": traces,
            "layout": {
                "title": {"text": f"{metric_label} — {', '.join(drivers)}"},
                "xaxis": {"title": "Distance (m)"},
                "yaxis": {"title": metric_label},
                "margin": {"t": 50, "r": 20, "b": 40, "l": 60},
                "template": "plotly_dark",
                "hovermode": "x unified",
            },
        }

    return {
        "circuit": circuit,
        "year": year,
        "session": session_type,
        "metric": metric,
        "drivers": driver_data,
        "chart": chart,
    }


def gear_shift_track(
    driver: str,
    circuit: str,
    year: int,
    session_type: str = "R",
    lap_number: int | None = None,
) -> dict:
    """
    Plot gear shift visualization on the circuit map using X/Y coordinates.
    Each consecutive pair of telemetry points is colored by the gear engaged
    at the start point, matching FastF1's matplotlib LineCollection approach.
    """
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=True, weather=False, messages=False)

    laps = session.laps.pick_drivers([driver])
    if laps.empty:
        return {"error": f"No laps found for {driver}"}

    if lap_number is not None:
        target = laps[laps["LapNumber"] == lap_number]
        if target.empty:
            return {"error": f"Lap {lap_number} not found"}
        lap = target.iloc[0]
    else:
        fastest = laps.pick_fastest()
        if fastest.empty:
            return {"error": "No fastest lap found"}
        lap = fastest

    try:
        tel = lap.get_telemetry()
    except Exception:
        return {"error": "No telemetry data"}

    if "X" not in tel.columns or "Y" not in tel.columns or "nGear" not in tel.columns:
        return {"error": "Missing X, Y, or nGear columns"}

    x_arr = tel["X"].values
    y_arr = tel["Y"].values
    gear_arr = tel["nGear"].values

    # Vibrant palette visible on dark background
    gear_colors = {
        1: "#7fc7ff",  2: "#1a6dd4",  3: "#6bdb5a",  4: "#1b8c1b",
        5: "#ff6b9d",  6: "#e02020",  7: "#ff9f33",  8: "#cc5500",
    }

    # Build continuous runs: each segment (i → i+1) is colored by gear_arr[i].
    # Transition points are included in BOTH the previous gear's run (as last pt)
    # and the next gear's run (as first pt), so no gaps appear between gear regions.
    segments: dict[int, list[tuple[float, float]]] = {g: [] for g in gear_colors}

    current_gear = int(gear_arr[0])
    run: list[tuple[float, float]] = [(float(x_arr[0]), float(y_arr[0]))]

    for i in range(1, len(gear_arr)):
        g = int(gear_arr[i])
        pt = (float(x_arr[i]), float(y_arr[i]))
        run.append(pt)
        if g != current_gear:
            if len(run) >= 2:
                segments[current_gear].extend(run)
                segments[current_gear].append((None, None))
            current_gear = g
            run = [pt]

    if len(run) >= 2:
        segments[current_gear].extend(run)

    traces = []
    # Background circuit outline (faint)
    traces.append({
        "x": [float(x) for x in x_arr],
        "y": [float(y) for y in y_arr],
        "type": "scatter",
        "mode": "lines",
        "name": "Circuit",
        "line": {"color": "rgba(255,255,255,0.08)", "width": 1.5},
        "showlegend": False,
        "hoverinfo": "none",
    })
    # Invisible hover anchor markers so Plotly fires onHover events
    traces.append({
        "x": [float(x) for x in x_arr],
        "y": [float(y) for y in y_arr],
        "type": "scatter",
        "mode": "markers",
        "marker": {"opacity": 0, "size": 5},
        "showlegend": False,
        "hoverinfo": "none",
        "name": "_hover",
    })
    # Colored gear segments
    for g in sorted(gear_colors):
        pts = segments[g]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        if any(x is not None for x in xs):
            traces.append({
                "x": xs,
                "y": ys,
                "type": "scatter",
                "mode": "lines",
                "name": f"Gear {g}",
                "legendgroup": "gears",
                "line": {"color": gear_colors[g], "width": 4.5},
                "connectgaps": False,
                "hoverinfo": "skip",
            })

    lap_time = lap["LapTime"]
    ft_str = str(lap_time) if pd.notna(lap_time) else None
    if ft_str and ft_str.startswith("0 days "):
        ft_str = ft_str[7:]

    event_name = session.event.get("EventName", circuit)
    title = (
        f"Fastest Lap Gear Shift Visualization<br>"
        f"<sup>{driver} — {event_name} {year}  |  Lap {int(lap['LapNumber'])}"
        f"{' (Fastest)' if lap_number is None else ''}</sup>"
    )

    diag = max(
        float(x_arr.max()) - float(x_arr.min()),
        float(y_arr.max()) - float(y_arr.min()),
        1.0,
    )

    chart = {
        "type": "gear_track",
        "data": traces,
        "layout": {
            "title": {"text": title, "font": {"size": 14}},
            "xaxis": {
                "visible": False, "autorange": True,
                "scaleanchor": "y", "scaleratio": 1,
                "constrain": "domain",
            },
            "yaxis": {
                "visible": False, "autorange": True,
                "constrain": "domain",
            },
            "margin": {"t": 55, "r": 10, "b": 40, "l": 10},
            "template": "plotly_dark",
            "paper_bgcolor": "rgba(0,0,0,0)",
            "plot_bgcolor": "rgba(0,0,0,0)",
            "showlegend": True,
            "legend": {
                "orientation": "h",
                "y": -0.1,
                "x": 0.5,
                "xanchor": "center",
                "font": {"size": 11},
                "itemclick": False,
                "itemdoubleclick": False,
            },
            "hovermode": "closest",
            "hoverdistance": 20,
            "spikedistance": 20,
            "dragmode": "zoom",
        },
    }

    return {
        "driver": driver,
        "circuit": circuit,
        "year": year,
        "session": session_type,
        "lap": {
            "number": int(lap["LapNumber"]),
            "time": ft_str,
            "is_fastest": lap_number is None,
        },
        "chart": chart,
        "telemetry": {
            "x": [float(v) for v in x_arr],
            "y": [float(v) for v in y_arr],
            "gear": [int(v) for v in gear_arr],
        },
    }


def lap_progression(
    driver: str,
    circuit: str,
    year: int,
    session_type: str = "R",
    max_laps: int | None = None,
) -> list[dict]:
    """
    Per-lap breakdown for a driver across all laps in a session.

    Handles DNF drivers correctly: laps the driver attempted before
    retiring are returned with telemetry where available and a DNF flag.
    """
    event = _event_name(year, circuit)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=True, weather=False, messages=False)

    laps = session.laps.pick_drivers([driver])
    if laps.empty:
        return []

    out = []
    for _, lap in laps.iterrows():
        lap_num = int(lap["LapNumber"])
        lap_time = lap["LapTime"]
        is_dnf = pd.isna(lap_time) or (hasattr(lap_time, "total_seconds") and lap_time.total_seconds() <= 0)

        # Get telemetry even for DNF laps (partial data may exist)
        avg_speed = None
        top_speed = None
        if not is_dnf:
            try:
                tel = lap.get_telemetry()
                if tel is not None and not tel.empty:
                    lap_dist = float(tel["Distance"].max())
                    lap_sec = lap_time.total_seconds()
                    avg_speed = round(lap_dist / lap_sec * 3.6, 1) if lap_sec > 0 else None
                    top_speed = round(float(tel["Speed"].max()), 1)
            except Exception:
                pass

        entry = {
            "lap_number": lap_num,
            "lap_time": str(lap_time) if not is_dnf else "DNF",
            "dnf": is_dnf,
            "sector_1_time": str(lap["Sector1Time"]) if pd.notna(lap.get("Sector1Time")) else None,
            "sector_2_time": str(lap["Sector2Time"]) if pd.notna(lap.get("Sector2Time")) else None,
            "sector_3_time": str(lap["Sector3Time"]) if pd.notna(lap.get("Sector3Time")) else None,
            "speed_i1": int(lap["SpeedI1"]) if pd.notna(lap.get("SpeedI1")) else None,
            "speed_i2": int(lap["SpeedI2"]) if pd.notna(lap.get("SpeedI2")) else None,
            "speed_fl": int(lap["SpeedFL"]) if pd.notna(lap.get("SpeedFL")) else None,
            "compound": lap.get("Compound", None),
            "tyre_life": int(lap["TyreLife"]) if pd.notna(lap.get("TyreLife")) else None,
            "position": int(lap["Position"]) if pd.notna(lap.get("Position")) else None,
            "is_fastest": bool(lap.get("IsFastest", False)),
            "avg_speed": avg_speed,
            "top_speed": top_speed,
        }
        out.append(entry)

        if max_laps is not None and len(out) >= max_laps:
            break

    return out
