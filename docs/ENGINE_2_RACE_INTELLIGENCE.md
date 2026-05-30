# Engine 2: Race Intelligence + Dashboard

## Overview
On-demand F1 race analytics powered by FastF1 API. Handles comparisons, summaries, telemetry, and standings. Backend returns structured JSON + Plotly JSON figures.

## Features
1. **Driver Comparison** - head-to-head stats (top speed, avg speed, fastest lap, sector times)
2. **Race Summary** - finishing order, gaps, DNFs, fastest lap, weather
3. **Telemetry Slices** - filtered telemetry for a specific driver/lap/metric
4. **Standings** - WDC (drivers) and WCC (constructors)
5. **Season Calendar** - upcoming/past sessions with results

## Logical Flow
```
User: "How fast was Max compared to Hamilton in Miami?"
    |
    v
[LLM Router] -> identifies "race_intelligence" intent
    -> chooses: compare_drivers({d1:"VER", d2:"HAM", circuit:"miami", year:2025})
    |
    v
[Validator Layer]
  1. Normalize: "max" -> "VER", "hamilton" -> "HAM", "miami" -> "miami"
  2. Check all values against data catalog
  3. Fill defaults: session=R, year=2025
    |
    v
[FastF1 Service] (fastf1_analyzer.py)
  1. Load session data (cached by FastF1)
  2. Get laps for both drivers
  3. Compute pre-computed stats:
     - Top speed, average speed
     - Fastest lap time + sector splits
     - Gap between drivers
  4. Generate Plotly JSON figure (speed trace overlay)
    |
    v
[LLM Response Generation]
  "Max Verstappen was 0.342s faster on average per lap.
   His top speed was 342.1 km/h vs Hamilton's 338.7 km/h.
   [chart: speed_trace_overlay]"
```

## Pre-Computed Stats (returned for any comparison)
| Stat | Description |
|---|---|
| `top_speed` | Highest speed recorded (km/h) |
| `avg_speed` | Mean speed across all laps |
| `fastest_lap` | Fastest lap time + sector times |
| `avg_lap_time` | Mean lap time |
| `consistency` | Lap time standard deviation |
| `gap` | Time gap at race end |
| `position_change` | Positions gained/lost |
| `pit_stops` | Count and avg duration |

## Tool Catalog (LLM-callable)
```
1. compare_drivers(driver1, driver2, circuit, year?, session?)
   -> { stats: {...}, chart: PlotlyJSON }
2. get_race_summary(circuit, year?, session?)
   -> { results: [...], fastest_lap: {...}, weather: {...}, chart: PlotlyJSON }
3. get_telemetry_slice(driver, circuit, year?, session?, lap_number?, metric?)
   -> { telemetry: [...], stats: {...}, chart: PlotlyJSON }
4. get_standings(year?, driver?)
   -> { standings: [...], chart: PlotlyJSON }
```

## Implementation Phases
| Phase | What | Depends On |
|---|---|---|
| 2a | FastF1 service core + caching (fastf1_analyzer.py, cache.py) | - |
| 2b | Tool implementations (compare, summary, telemetry, standings) | 2a |
| 2c | Race intelligence router + validator | 2b |
| 2d | Test with sample queries | 2c |
| 2e | Plotly JSON chart generation | 2b |
