# F1nalyse — Project Checkpoint

## Overview
Full-stack F1 data analytics platform. FastAPI backend + React frontend. FastF1-powered race data, Plotly visualizations, AI steward for regulatory queries.

---

## Backend ✅

### Architecture
- FastAPI app with CORS, lifespan cache init, global exception handler
- Routers: `resources`, `query`, `penalty`, `race`
- Service layer: `fastf1_analyzer`, `telemetry_service`, `position_service`, `team_pace_service`, `tyre_service`, `qualifying_service`, `standings_service`, `rag_engine`, `llm_client`
- Validation layer: `validator.py` (drivers, circuits, seasons, sessions)
- Data catalogs: `valid_drivers.json`, `valid_circuits.json`, `valid_seasons.json`, `valid_constructors.json`, `aliases.json`

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/drivers` | GET | List drivers (optional `?year=`) |
| `/api/drivers/{code}` | GET | Driver career stats |
| `/api/circuits` | GET | List circuits |
| `/api/circuits/{key}` | GET | Circuit detail + winners |
| `/api/seasons` | GET | Available years |
| `/api/constructors` | GET | List constructors |
| `/api/constructors/{slug}` | GET | Constructor detail |
| `/api/races/{circuit}` | GET | Race results |
| `/api/race/standings` | GET | Driver/constructor standings |
| `/api/race/compare` | POST | Driver/constructor comparison |
| `/api/race/telemetry` | POST | Single-driver lap telemetry |
| `/api/race/telemetry/compare` | POST | Multi-driver telemetry |
| `/api/race/telemetry/gear-track` | POST | Gear shift track |
| `/api/race/laps` | POST | Lap progression |
| `/api/race/schedule/{year}` | GET | Event schedule |
| `/api/race/position-changes` | POST | Per-driver position per lap |
| `/api/race/team-pace` | POST | Team boxplot lap times |
| `/api/race/tyre-strategies` | POST | Stint/compound bar chart |
| `/api/race/qualifying` | POST | Qualifying time deltas |
| `/api/query` | POST | RAG query (AI Steward) |
| `/api/penalty/predict` | POST | Penalty prediction |

### Session Support
All race endpoints accept: `R`, `Q`, `S`, `SQ`, `SS`, `FP1`, `FP2`, `FP3`

### Services
- **FastF1 Analyzer** — career stats, race/constructor comparison, event name resolution
- **Position Service** — lap-by-lap driver positions, FastF1 colours
- **Team Pace Service** — quick-lap boxplot per team, FastF1 team colours
- **Tyre Service** — stint length/compound stacked bars, FastF1 compound colours
- **Qualifying Service** — fastest-lap delta bars, FastF1 team colours
- **Telemetry Service** — single/multi/gear telemetry with Plotly charts
- **Standings Service** — driver/constructor championship standings
- **RAG Engine** — vector search over FIA rulebook + LLM answer generation
- **Validator** — input validation with suggestions

### Data
- FastF1 cache enabled at `FASTF1_CACHE_DIR`
- JSON catalogs for drivers, circuits, constructors, seasons, aliases
- Qdrant vector DB for RAG

---

## Frontend ✅

### Pages
- **Home** — Parallax hero, feature cards, live ticker, track history
- **Live Season** — Schedule, race results, standings
- **Analysis** — Telemetry (single/multi/gear), Laps, Compare, Penalty tabs
- **Race Strategy** — 4 bento cards (Position, Pace, Tyres, Qualifying) with floating modals
- **AI Steward** — Chat interface for F1 regulatory queries

### Components
- `PillNav`, `Navbar`, `Footer`, `CurvedLoop`, `MagicBento`, `BentoCard`, `PlotlyChart`, `LoadingSpinner`, `ErrorBanner`, `AiFloatingButton`, `Ticker`

### Key Features
- Pill-style animated navigation with sliding active indicator
- Magic Bento grid with stars, spotlight, border glow, 3D tilt, magnetism, click ripple
- Curved SVG marquee text animated via textPath
- All 4 Race Strategy charts fetched in parallel on Analyse
- Year-aware driver dropdowns
- Floating modal for chart detail view
- FastF1 colour scheme matched in all Plotly charts
- Dark theme throughout with F1 red accents

### Tech Stack
- React 18 + TypeScript
- Framer Motion (animations, page transitions)
- Tailwind CSS (custom F1 design tokens)
- Plotly.js + react-plotly.js
- React Router v6

---

## Backend Run Commands

All commands run from the project root (`F1nalyse/`).

| Command | Description |
|---|---|
| `python -m uvicorn backend.main:app --reload` | Start the FastAPI dev server on `localhost:8000` |
| `python -m backend.scripts.refresh_catalog` | Rebuild driver/constructor/circuit JSON catalogs from FastF1 |
| `python -m backend.scrapers.fia_scraper` | Download FIA steward decision PDFs by season |
| `python -m backend.scrapers.fia_pdf_parser` | Parse PDFs → structured JSONL via LLM (Groq/Gemini) |
| `python -m backend.vector_db.build_db` | Embed parsed precedents into ChromaDB vector store |

> **Note:** `.env` requires a valid `GROQ_API_KEY` (or `GEMINI_API_KEY`) for LLM-dependent commands (parser, RAG querying).

---

## Frontend Polish (Completed)
- **Mobile responsiveness** — tables overflow-x-auto, tab wrapping, responsive filter controls on all Analysis tabs, animated mobile menu
- **Framer Motion** — enhanced parallax depth (3-layer hero with useSpring), scroll-triggered reveals throughout Home page
- **Error states + skeletons** — `SkeletonCard`, `SkeletonTable`, `SkeletonChart` components; error banners on all API failures in Analysis tabs
- **AI Steward streaming + persistence** — typewriter streaming effect via `StreamingText`, message history saved to `localStorage`
- **Dark/light theme toggle** — CSS variables driven, `ThemeContext` with localStorage persistence, sun/moon toggle in Navbar

## 🔜 Coming Next
- Live session data refresh
- Sector comparison overlays
- Race head-to-head sector breakdown
- Expanded AI Steward with more data sources
- Tests
- Docker/containerization
