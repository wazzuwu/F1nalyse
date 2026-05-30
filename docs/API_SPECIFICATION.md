# F1nalyse API Specification — v3

> Full endpoint design, request/response shapes, and status.
> Covers Race Intelligence (Phase 3 — ✅ complete) + existing Penalty Predictor.

---

## 1. Base URL

```
http://localhost:8000
```

All routes prefixed under `/api`.

---

## 2. Resource Endpoints (GET) — Quick Lookups

These populate frontend dropdowns, cards, and info panels.

### 2.1 `GET /api/drivers`

List all 98 drivers with their 3-letter code and current team.

```json
// Response 200
[
  { "code": "VER", "full_name": "Max Verstappen", "team": "Red Bull Racing" },
  { "code": "HAM", "full_name": "Lewis Hamilton",  "team": "Ferrari" },
  ...
]
```

---

### 2.2 `GET /api/drivers/{code}`

Career stats for a single driver (aggregated from Ergast standings per year).

**Path:** `code` — 3-letter driver code (e.g. `VER`, `HAM`)

```json
// Response 200
{
  "code": "VER",
  "full_name": "Max Verstappen",
  "career": {
    "seasons": [2015, 2016, ...],
    "wins": 71,
    "points": 2950.5,
    "best_championship": 1
  },
  "per_season": [
    { "year": 2025, "team": "Red Bull Racing", "wins": 5, "points": 187, "position": 1 },
    { "year": 2024, "team": "Red Bull Racing", "wins": 9, "points": 437, "position": 1 },
    ...
  ]
}
```

```json
// Response 404
{ "detail": "Driver 'XYZ' not found. Valid codes: VER, HAM, LEC, ..." }
```

---

### 2.3 `GET /api/circuits`

List all 27 circuits.

```json
// Response 200
[
  { "key": "miami",       "full_name": "Miami International Autodrome" },
  { "key": "monza",       "full_name": "Autodromo Nazionale Monza" },
  ...
]
```

---

### 2.4 `GET /api/circuits/{key}`

Circuit info + winners by year (loaded from FastF1 per-year).

**Path:** `key` — circuit key (e.g. `miami`, `monza`)

```json
// Response 200
{
  "key": "monza",
  "full_name": "Autodromo Nazionale Monza",
  "winners_by_year": [
    { "year": 2024, "winner": "LEC", "team": "Ferrari" },
    { "year": 2023, "winner": "VER", "team": "Red Bull Racing" },
    ...
  ]
}
```

---

### 2.5 `GET /api/constructors`

List all 41 constructors with current (latest year) driver lineup.

```json
// Response 200
[
  { "id": "red_bull", "full_name": "Red Bull Racing", "drivers": ["VER", "PER"] },
  { "id": "ferrari",  "full_name": "Ferrari",          "drivers": ["LEC", "HAM"] },
  ...
]
```

---

### 2.6 `GET /api/constructors/{slug}`

Constructor stats + season history (from Ergast standings).

**Path:** `slug` — constructor id (e.g. `red_bull`, `ferrari`)

```json
// Response 200
{
  "id": "red_bull",
  "full_name": "Red Bull Racing",
  "drivers": ["VER", "PER", "RIC", ...],
  "per_season": [
    { "year": 2025, "wins": 8, "points": 340, "position": 1 },
    ...
  ]
}
```

---

### 2.7 `GET /api/races`

List all race events for a given year. If no year provided, returns latest season.

**Query params:** `year` (optional, default: latest)

```json
// Response 200
{
  "year": 2025,
  "rounds": [
    { "round": 1, "circuit": "melbourne", "full_name": "Australian Grand Prix", "date": "2025-03-16", "winner": "NOR" },
    { "round": 2, "circuit": "shanghai",  "full_name": "Chinese Grand Prix",    "date": "2025-03-23", "winner": "VER" },
    ...
  ]
}
```

---

### 2.8 `GET /api/races/{circuit}`

Results for a specific circuit/event.

**Path:** `circuit` — circuit key

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | int | latest | Season year |
| `session` | str | `"R"` | `R` (race), `Q` (quali), `SPR` (sprint) |

```json
// Response 200 (session=R)
{
  "circuit": "miami",
  "year": 2025,
  "session": "R",
  "results": [
    { "position": 1, "code": "VER", "team": "Red Bull Racing", "time": "1:32:18.4", "gap": null, "laps": 57, "status": "Finished", "grid": 1, "positions_gained": 0 },
    { "position": 2, "code": "LEC", "team": "Ferrari",         "time": "1:32:22.1", "gap": "+3.7", "laps": 57, "status": "Finished", "grid": 3, "positions_gained": 1 },
    ...
  ],
  "fastest_lap": { "code": "HAM", "time": "1:31.2", "lap": 46 },
  "weather": { "air_temp": 28, "track_temp": 42, "humidity": 62 },
  "dnfs": ["RUS", "ALO"]
}
```

```json
// Response 200 (session=Q)
{
  "circuit": "miami",
  "year": 2025,
  "session": "Q",
  "results": [
    { "position": 1, "code": "VER", "team": "Red Bull Racing", "q1": "1:28.4", "q2": "1:27.9", "q3": "1:27.2" },
    { "position": 2, "code": "LEC", "team": "Ferrari",         "q1": "1:28.6", "q2": "1:28.1", "q3": "1:27.5", "gap_to_pole": "+0.3" },
    ...
  ]
}
```

---

### 2.9 `GET /api/seasons`

List available seasons.

```json
// Response 200
[2000, 2001, 2002, ..., 2025]
```

---

### 2.10 `GET /api/aliases`

177 name→3-letter-code mappings for LLM routing.

```json
// Response 200
{ "max": "VER", "lewis": "HAM", "charles": "LEC", ... }
```

---

## 3. Action Endpoints (POST) — Complex Operations

### 3.1 `POST /api/race/compare`

N-driver or N-constructor comparison. Dynamic session type. Defaults to career stats when no circuit/year, session data when circuit is given.

**Request Body:**

```json
{
  "drivers": ["VER", "HAM", "NOR"],
  "constructors": null,
  "circuit": "miami",
  "year": 2025,
  "session": "R"
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `drivers` | string[] | `[]` | 3-letter codes, max 5 |
| `constructors` | string[] | `[]` | Mutually exclusive with drivers |
| `circuit` | string | null | Circuit key. If null → career stats |
| `year` | int | null | Season year. |
| `session` | string | `"R"` | `R`, `Q`, `SPR`. Only when circuit+year set |

**Behavior:**

| `drivers` | `circuit` | `year` | Returns |
|-----------|-----------|--------|---------|
| 1+ | null | null | Career stats (seasons, wins, points, best champ) |
| 1+ | ✅ | ✅ | Session data (lap times, position, pit stops, laps led, weather) |
| [] | ✅ | ✅ | constructors mode — same shape |

**Response 200 (session scope):**

```json
{
  "type": "driver",
  "entities": ["VER", "HAM", "NOR"],
  "scope": { "circuit": "miami", "year": 2025, "session": "R" },
  "stats": {
    "VER": {
      "position": 1,
      "fastest_lap": "1:31.2",
      "avg_lap_time": "1:32.4",
      "consistency": "0.42",
      "pit_stops": 2,
      "laps_led": 42
    },
    "HAM": {
      "position": 2,
      "fastest_lap": "1:31.6",
      "avg_lap_time": "1:32.8",
      "consistency": "0.58",
      "pit_stops": 2,
      "laps_led": 8
    }
  },
  "weather": { "air_temp": 28, "track_temp": 42, "humidity": 62 }
}
```

**Response 200 (career scope):**

```json
{
  "type": "driver",
  "entities": ["VER", "HAM"],
  "scope": { "circuit": null, "year": null, "session": null },
  "stats": {
    "VER": { "seasons": 14, "total_points": 2950.5, "total_wins": 71, "best_championship": 1 },
    "HAM": { "seasons": 19, "total_points": 4800.5, "total_wins": 105, "best_championship": 1 }
  }
}
```

---

### 3.2 `POST /api/race/telemetry`

Single driver lap deep-dive with metric choice and optional comparison overlay.

**Request Body:**

```json
{
  "driver": "VER",
  "circuit": "suzuka",
  "year": 2025,
  "session": "R",
  "lap_number": null,
  "metric": "speed",
  "compare_driver": "HAM"
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `driver` | string | required | 3-letter code |
| `circuit` | string | required | Circuit key |
| `year` | int | required | |
| `session` | string | `"R"` | |
| `lap_number` | int | null | null → fastest lap |
| `metric` | string | `"speed"` | `speed`, `throttle`, `brake`, `gear`, `rpm`, `drs`, `all` |
| `compare_driver` | string | null | Overlays second driver's telemetry |

**Response 200:**

```json
{
  "driver": "VER",
  "circuit": "suzuka",
  "lap": { "number": 3, "time": "1:34.2", "is_fastest": true },
  "stats": {
    "avg_speed": 224.5,
    "top_speed": 318.2,
    "min_speed": 82.1,
    "avg_throttle": 72.3,
    "avg_brake": 12.8
  },
  "telemetry": [
    { "distance": 0,   "speed": 82.1,  "throttle": 0,   "brake": 100, "gear": 2, "rpm": 10500, "drs": 0 },
    ...
  ],
  "chart": {
    "type": "speed_trace",
    "data": [ { "x": [0, ...], "y": [82, ...], "type": "scatter", "mode": "lines", "name": "Speed (km/h)" } ],
    "layout": { "title": "Speed vs Distance", "xaxis": { "title": "Distance (m)" }, "template": "plotly_dark" }
  }
}
```

---

### 3.3 `POST /api/race/laps`

Per-lap progression for a driver across all laps in a session.

**Request Body:**

```json
{
  "driver": "VER",
  "circuit": "miami",
  "year": 2024,
  "session": "R",
  "max_laps": null
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `driver` | string | required | 3-letter code |
| `circuit` | string | required | Circuit key |
| `year` | int | required | |
| `session` | string | `"R"` | `R` or `Q` |
| `max_laps` | int | null | Limit results (null = all laps) |

**Response 200:**

```json
[
  {
    "lap_number": 1,
    "lap_time": "1:34.338",
    "sector_1_time": null,
    "sector_2_time": "0:34.990",
    "sector_3_time": "0:26.211",
    "speed_i1": 295,
    "speed_i2": 310,
    "speed_fl": 280,
    "compound": "MEDIUM",
    "tyre_life": 1,
    "position": 1,
    "is_fastest": false,
    "avg_speed": 199.3,
    "top_speed": 312.0
  },
  ...
]
```

---

### 3.4 `GET /api/race/standings`

Driver or constructor standings for a season.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | int | latest | Season year |
| `type` | str | `"driver"` | `driver` or `constructor` |
| `round` | int | null | After specific round (null → final) |

```json
// Response 200
{
  "year": 2025,
  "type": "driver",
  "round": null,
  "standings": [
    { "position": 1, "code": "VER", "full_name": "Max Verstappen", "team": "Red Bull Racing", "points": 437, "wins": 9 },
    { "position": 2, "code": "NOR", "full_name": "Lando Norris", "team": "McLaren", "points": 374, "wins": 4 },
    ...
  ]
}
```

Constructor variant (`?type=constructor`):

```json
{
  "year": 2025,
  "type": "constructor",
  "standings": [
    { "position": 1, "id": "mclaren",  "full_name": "McLaren",         "points": 666, "wins": 6 },
    { "position": 2, "id": "red_bull", "full_name": "Red Bull Racing", "points": 589, "wins": 9 },
    ...
  ]
}
```

---

### 3.5 `POST /api/penalty/predict`

✅ Existing — unchanged.

```json
// Request
{ "incident": "kimi raikkonen gearbox change italian gp", "year": 2019, "breach_type": null }

// Response
{
  "prediction": "5 grid position penalty",
  "confidence": 0.92,
  "precedents": [
    { "driver": "RAI", "circuit": "monza", "year": 2019, "penalty": "5 grid places" }
  ],
  "reasoning": "Kimi Raikkonen changed his gearbox ahead of the 2019 Italian Grand Prix..."
}
```

---

### 3.6 `POST /api/query`

LLM-routed natural language entry point. Uses Groq (llama-3.3-70b) with an intent catalog to route to the right FastF1 operation.

```json
// Request
{ "query": "How fast was Max vs Hamilton in Miami and what was the weather?" }

// Response
{
  "answer": "VER: P2, fastest 1:31.261 | HAM: P6, fastest 1:31.584",
  "engine": "compare",
  "chart": null
}
```

The LLM outputs `{intent, params}`, the backend dispatches to the matching FastF1 function, and returns structured data + a human-readable summary.

---

## 4. Full Endpoint Summary

| # | Method | Endpoint | Purpose | Status |
|---|--------|----------|---------|--------|
| 1 | `GET` | `/health` | Health check | ✅ |
| 2 | `GET` | `/api/drivers` | List drivers | ✅ |
| 3 | `GET` | `/api/drivers/{code}` | Driver career stats | ✅ |
| 4 | `GET` | `/api/circuits` | List circuits | ✅ |
| 5 | `GET` | `/api/circuits/{key}` | Circuit info + winners | ✅ |
| 6 | `GET` | `/api/constructors` | List constructors | ✅ |
| 7 | `GET` | `/api/constructors/{slug}` | Constructor stats | ✅ |
| 8 | `GET` | `/api/races` | Race calendar for a year | ✅ |
| 9 | `GET` | `/api/races/{circuit}` | Race/quali results | ✅ |
| 10 | `GET` | `/api/seasons` | Available seasons | ✅ |
| 11 | `GET` | `/api/aliases` | Name→code mappings | ✅ |
| 12 | `POST` | `/api/race/compare` | N-driver / N-constructor comparison | ✅ |
| 13 | `POST` | `/api/race/telemetry` | Telemetry deep-dive with chart | ✅ |
| 14 | `POST` | `/api/race/laps` | Per-lap progression | ✅ |
| 15 | `GET` | `/api/race/standings` | Driver/constructor standings | ✅ |
| 16 | `POST` | `/api/penalty/predict` | Penalty prediction | ✅ |
| 17 | `POST` | `/api/query` | Natural language chat (LLM routing) | ✅ |

## 5. Tech Stack

- **Backend:** FastAPI, FastF1, Ergast, Pandas
- **LLM:** Groq (llama-3.3-70b) or Gemini (configurable)
- **Cache:** FastF1 on-disk cache at `data/fastf1_cache/`
- **Data catalogs:** JSON files rebuilt via `refresh_catalog.py`
