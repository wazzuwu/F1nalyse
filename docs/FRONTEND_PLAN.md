# F1nalyse — Frontend Plan (Phase 4)

> Layout, pages, components, and navigation structure.
> Prototype-first approach — we'll build rough pages then iterate.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| **Framework** | React 18 + TypeScript |
| **Build tool** | Vite |
| **Styling** | Tailwind CSS v4 |
| **Charts** | react-plotly.js (renders Plotly JSON from API) |
| **Routing** | React Router v7 |
| **HTTP** | fetch (no extra lib needed) |

---

## 2. Pages (3 total + AI Query widget)

```
Navbar
├── Home            (/)         — project intro, features, quick race browser
├── Live Season     (/live)     — 2026 standings + recent race results
└── Analysis        (/analysis) — tabs: Compare / Telemetry / Laps / Penalty

AI Query — floating chat button on all pages, slides out a panel
```

---

## 3. Page Layouts (Desktop-First)

### 3.1 Home `/`

```
┌──────────────────────────────────────────────┐
│  Navbar                                       │
├──────────────────────────────────────────────┤
│  Hero Section                                 │
│  ┌────────────────────────────────────────┐  │
│  │  F1nalyse — AI-powered F1 intelligence │  │
│  │  Analyze races, compare drivers,       │  │
│  │  predict penalties, explore telemetry  │  │
│  │                                         │  │
│  │  [Try AI Query →]  [Live Season →]     │  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│  Feature Cards (3-column)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────┐ │
│  │ Live Season  │ │ Analysis     │ │ AI   │ │
│  │ Standings +  │ │ Compare,     │ │ Ask  │ │
│  │ race results │ │ telemetry,   │ │ any  │ │
│  │ for 2026     │ │ laps,penalty │ │thing │ │
│  └──────────────┘ └──────────────┘ └──────┘ │
├──────────────────────────────────────────────┤
│  Quick Race Browser                           │
│  ┌──────────┐ ┌──────────┐  [Load]          │
│  │ Year [▼] │ │ Circuit  │                  │
│  └──────────┘ └──────────┘                  │
│  ┌────────────────────────────────────────┐  │
│  │ Classification Table (top 5 + FL)      │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

Purpose: landing page that explains what F1nalyse is, lets users quickly look up a race result, and directs them to the main tools.

---

### 3.2 Live Season `/live`

```
┌──────────────────────────────────────────────┐
│  Navbar                                       │
├──────────────────────────────────────────────┤
│  Season: 2026 (hardcoded, no selector)        │
├──────────────────┬───────────────────────────┤
│  Left Panel      │  Right Panel               │
│                  │                            │
│  ┌────────────┐  │  ┌────────────────────┐   │
│  │ Latest Race│  │  │ Driver Standings   │   │
│  │ Result     │  │  │ (top 10 + chart)   │   │
│  │ Top 3 + FL │  │  │                    │   │
│  │ + weather  │  │  └────────────────────┘   │
│  └────────────┘  │                            │
│                  │  ┌────────────────────┐   │
│  ┌────────────┐  │  │ Constructor        │   │
│  │ Race       │  │  │ Standings          │   │
│  │ Calendar   │  │  │ (top 5 + chart)    │   │
│  │ (rounds)   │  │  └────────────────────┘   │
│  └────────────┘  │                            │
└──────────────────┴───────────────────────────┘
```

- Hardcoded to 2026 — no year selector
- Auto-loads latest race result from `GET /api/races?year=2026`
- Driver standings + constructor standings from `GET /api/race/standings?year=2026`
- Race calendar from `GET /api/races?year=2026` (list of rounds with winners)
- Periodically refreshes (or pull-to-refresh)

---

### 3.3 Analysis `/analysis`

Single page with tab navigation. All analysis tools in one place.

```
┌──────────────────────────────────────────────┐
│  Navbar                                       │
├──────────────────────────────────────────────┤
│  [Compare] [Telemetry] [Laps] [Penalty]      │
├──────────────────────────────────────────────┤
│  (active tab content below)                   │
└──────────────────────────────────────────────┘
```

#### Tab: Compare

```
┌──────────────────────────────────────────────┐
│  Filters                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Drivers  │ │ Circuit  │ │ Year     │     │
│  │ [VER, --]│ │ [miami ▼]│ │ [2024 ▼] │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│  [x] Qualifying mode   [Compare ▶]          │
├──────────────────────────────────────────────┤
│  Stats Cards (one per driver)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ VER P2   │ │ LEC P3   │ │ NOR P1   │    │
│  │ 1 pit    │ │ 1 pit    │ │ 2 pits   │    │
│  │ 22 led   │ │ 0 led    │ │ 35 led   │    │
│  └──────────┘ └──────────┘ └──────────┘    │
├──────────────────────────────────────────────┤
│  Lap Time Distribution (Plotly scatter)       │
└──────────────────────────────────────────────┘
```

#### Tab: Telemetry

```
┌──────────────────────────────────────────────┐
│  Filters                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Driver   │ │ Circuit  │ │ Year     │     │
│  │ [VER  ▼]│ │ [miami ▼]│ │ [2024 ▼]│     │
│  └──────────┘ └──────────┘ └──────────┘     │
│  Lap: [Fastest ▼]  Metric: [Speed ▼]        │
│  Compare: [None ▼]                           │
│  [Load ▶]                                     │
├──────────────────────────────────────────────┤
│  Stats: Avg 224 | Top 318 | Min 82 | Throt   │
├──────────────────────────────────────────────┤
│  Speed vs Distance (Plotly line chart)        │
└──────────────────────────────────────────────┘
```

#### Tab: Laps

```
┌──────────────────────────────────────────────┐
│  Filters                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Driver   │ │ Circuit  │ │ Year     │     │
│  │ [VER  ▼]│ │ [miami ▼]│ │ [2024 ▼]│     │
│  └──────────┘ └──────────┘ └──────────┘     │
│  Max Laps: [20]  [Load ▶]                    │
├──────────────────────────────────────────────┤
│  Lap Time per Lap (Plotly line, colored by   │
│  tire compound)                               │
├──────────────────────────────────────────────┤
│  Lap Table (scrollable)                       │
│  Lap │ Time   │ S1/S2/S3 │ Comp  │ Avg  Top │
│  1   │ 1:34   │ -/35/26  │ MED   │ 199  312 │
│  2   │ 1:33   │ 31/35/26 │ MED   │ 206  315 │
└──────────────────────────────────────────────┘
```

#### Tab: Penalty

```
┌──────────────────────────────────────────────┐
│  Text Area + Year filter                      │
│  ┌────────────────────────────────────────┐  │
│  │ Describe the incident...               │  │
│  │ (e.g., gearbox change monza 2019)      │  │
│  └────────────────────────────────────────┘  │
│  Year: [2019 ▼]  [Predict ▶]                │
├──────────────────────────────────────────────┤
│  Prediction Card + Precedents Table          │
│  ┌────────────────────────────────────────┐  │
│  │  5 grid position penalty  (92% conf)  │  │
│  │  Reasoning: Kimi Raikkonen...         │  │
│  └────────────────────────────────────────┘  │
│  ┌──────────┬────────┬──────┬──────────┐    │
│  │ Driver   │Circuit │ Year │ Penalty  │    │
│  │ RAI      │ Monza  │ 2019 │ 5 places │    │
│  └──────────┴────────┴──────┴──────────┘    │
└──────────────────────────────────────────────┘
```

---

### 3.4 AI Query (Floating Widget)

```
┌──────────────────────────────────────────────┐
│  (page content)                               │
│                                        ┌───┐ │
│                                        │ 💬│ │  ← Floating button (bottom-right)
│                                        └───┘ │
└──────────────────────────────────────────────┘

When clicked, slides open from right:
┌─────────────────┐
│ AI Query        │
│ ┌─────────────┐ │
│ │ User: ...   │ │
│ │ AI: ...     │ │
│ └─────────────┘ │
│ ┌───────────┐   │
│ │ Ask F1... │▶│ │
│ └───────────┘   │
└─────────────────┘
```

- Appears on all pages as a floating action button
- Opens a slide-out panel (chat-style)
- Posts to `POST /api/query`
- Shows response + engine badge
- If the response includes chart data, show a small Plotly preview

---

## 4. Shared Components

| Component | Description | Used On |
|---|---|---|
| `Navbar` | Top nav with logo + links to Home/Live/Analysis | All pages |
| `DriverSelect` | Multi-select, autocomplete from `/api/drivers` | Analysis (Compare) |
| `CircuitSelect` | Single select from `/api/circuits` | Home, Analysis (all tabs) |
| `YearSelect` | Year dropdown (2000–2026, but 2026 marked "current") | Home, Analysis |
| `ClassificationTable` | Race/quali results table | Home, Live |
| `StandingsTable` | Driver/constructor standings | Live |
| `PlotlyChart` | Renders Plotly JSON from API | Home, Live, Analysis |
| `StatsCard` | Key-value stat display | Analysis (Compare, Telemetry) |
| `WeatherCard` | Air temp, track temp, humidity | Live, Home |
| `FastestLapCard` | Fastest lap info card | Live, Home |
| `TabNav` | Horizontal tab bar for Analysis page | Analysis |
| `AiFloatingButton` | FAB + slide-out chat panel | All pages |
| `LoadingSpinner` | Loading state | All |
| `ErrorBanner` | Error display | All |

---

## 5. API → Component Mapping

| Endpoint | Used By |
|---|---|
| `GET /api/drivers` | `DriverSelect` options |
| `GET /api/circuits` | `CircuitSelect` options |
| `GET /api/seasons` | `YearSelect` options |
| `GET /api/races?year=X` | Live (calendar), Home (race picker) |
| `GET /api/races/{circuit}?year=X` | Home (quick results), Live (latest race) |
| `GET /api/race/standings?year=2026` | Live (driver + constructor) |
| `POST /api/race/compare` | Analysis → Compare tab |
| `POST /api/race/telemetry` | Analysis → Telemetry tab |
| `POST /api/race/laps` | Analysis → Laps tab |
| `POST /api/penalty/predict` | Analysis → Penalty tab |
| `POST /api/query` | AI Query widget (all pages) |

---

## 6. Directory Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── api/
│   │   └── client.ts
│   ├── types/
│   │   └── index.ts
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── DriverSelect.tsx
│   │   ├── CircuitSelect.tsx
│   │   ├── YearSelect.tsx
│   │   ├── ClassificationTable.tsx
│   │   ├── StandingsTable.tsx
│   │   ├── PlotlyChart.tsx
│   │   ├── StatsCard.tsx
│   │   ├── WeatherCard.tsx
│   │   ├── FastestLapCard.tsx
│   │   ├── TabNav.tsx
│   │   ├── AiFloatingButton.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── ErrorBanner.tsx
│   └── pages/
│       ├── Home.tsx
│       ├── LiveSeason.tsx
│       └── Analysis.tsx
```

---

## 7. Build Order (Prototype First)

1. Scaffold Vite + React + TypeScript + Tailwind + Router
2. Build `Navbar` + `LoadingSpinner` + `ErrorBanner`
3. Build `PlotlyChart` wrapper (takes Plotly JSON, renders with react-plotly)
4. Build **Home** page — hero, feature cards, quick race browser
5. Build **Live Season** — standings + latest race result + calendar (2026 hardcoded)
6. Build **Analysis → Compare** tab — driver selectors + stats cards
7. Build **Analysis → Telemetry** tab — speed trace chart + metric selector
8. Build **Analysis → Laps** tab — line chart + lap table
9. Build **Analysis → Penalty** tab — text input + prediction card
10. Build `AiFloatingButton` — slide-out chat on all pages
