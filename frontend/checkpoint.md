# F1nalyse — Project Checkpoint

## ✅ Completed

### Backend API

#### Core Infrastructure
- [x] FastAPI server with CORS, global error handler, lifespan startup validation
- [x] FastF1 cache enabled on startup (`data/fastf1_cache/`)
- [x] Catalog system (`valid_drivers.json`, `valid_constructors.json`, `valid_circuits.json`, `valid_seasons.json`, `aliases.json`)
- [x] LLM client with Groq + Gemini support, rate limiting, fallback
- [x] RAG engine with ChromaDB for FIA precedent retrieval
- [x] `/health` endpoint

#### Race Endpoints (`/api/race`)
- [x] `GET /standings` — driver & constructor standings via Ergast
- [x] `POST /compare` — driver/constructor head-to-head across sessions
- [x] `POST /telemetry` — single-lap telemetry (speed, throttle, brake, RPM, DRS, gear)
- [x] `POST /telemetry/compare` — multi-driver telemetry overlay
- [x] `POST /telemetry/gear-track` — gear shift track visualization
- [x] `POST /laps` — lap-by-lap progression
- [x] `POST /position-changes` — position change over race distance
- [x] `POST /team-pace` — team pace boxplot data
- [x] `POST /tyre-strategies` — stint-level compound data
- [x] `POST /qualifying` — Q1/Q2/Q3 times with gap to pole
- [x] `GET /schedule/{year}` — full season schedule with session-level dates (FP1–Race, local + UTC)
- [x] `GET /next` — next race weekend with countdown, next-session detection, session list
- [x] `GET /live-season` — **cached bundle** (standings + schedule + next race + latest race), 15-day TTL, stale-while-refresh pattern, background async refresh

#### Resource Endpoints (`/api`)
- [x] `GET /drivers` — list drivers for a year
- [x] `GET /drivers/{code}` — driver career stats per season
- [x] `GET /circuits` — circuit list
- [x] `GET /circuits/{key}` — circuit detail with winners by year
- [x] `GET /constructors` — constructor list
- [x] `GET /constructors/{slug}` — constructor detail with per-season stats
- [x] `GET /races/{circuit}` — race/qualifying classification results
- [x] `GET /seasons` — available season years (2000–2026)

#### Query / AI Endpoint (`/api`)
- [x] `POST /query` — intent classification + routing + LLM answer generation (2-call architecture)
- [x] Verbosity detection (`_detect_verbosity`) for response depth
- [x] Strategy summarization (`_summarize_strategy`) from lap data
- [x] Chart data stripping before LLM context injection (`_strip_charts`)

#### Penalty Endpoint (`/api/penalty`)
- [x] PDF ingestion pipeline for FIA documents
- [x] ChromaDB vector store with BGE embeddings
- [x] RAG-based penalty prediction with precedent citations

### Frontend

#### Navigation
- [x] `Navbar` — responsive, scroll-aware backdrop blur, mobile hamburger menu
- [x] `PillNav` — animated pill-style desktop navigation with sliding indicator
- [x] `Footer` — site-wide footer with subscribe, social links, quick links

#### Home (`/`)
- [x] Full-screen parallax hero with `f1-car.jpg`, dual glow spheres, animated CTAs
- [x] Live Stats Bar — reads from cached `/api/race/live-season`, shows leader/last winner/next race/races completed
- [x] Capabilities Grid — 2×2 glassmorphism cards (Live Season, Race Analysis, AI Steward, Race Strategy) with colored accent dots
- [x] Race Explorer — glassmorphism card with year/circuit selectors, results table with team colors, FL badge, position bars

#### Live Season (`/live`)
- [x] **CountdownTimer** — live ticking days/hours/minutes/seconds to next session
- [x] **SessionTimeline** — visual session list (FP1/FP2/FP3/Q/Race) with Done/Next badges
- [x] Next race card in hero with full session breakdown + countdown
- [x] Driver Standings — team-colored progress bars, position-change arrows (▲/▼), top-10 toggle
- [x] Constructor Standings — same treatment with constructor colors
- [x] Latest Race — animated podium (P1/P2/P3), top-10 results table, DNF/DNS/DSQ badges, fastest lap display
- [x] Race Calendar — status badges (Done/Next/Upcoming/Sprint), session badges for next race, scrollable
- [x] Season stat cards (races completed, next race, last winner, championship leader)
- [x] Live data from FastF1 via cached `/api/race/live-season`
- [x] Refresh button with rotating icon
- [x] Year dropdown removed (always current season)

#### Analysis (`/analysis`)
- [x] Telemetry tab — per-driver lap telemetry charts (speed, throttle, brake, RPM, DRS, gear)
- [x] Multi-driver telemetry comparison
- [x] Gear shift track visualization
- [x] Lap progression analysis
- [x] Compare tab — driver/constructor head-to-head stats
- [x] Penalty prediction (AI Steward integration via query)
- [x] All filters: year / circuit / session / driver

#### Race Strategy (`/strategy`)
- [x] Hero with `race.jpg` background, CurvedLoop marquee animation
- [x] Filter bar: year, circuit, session, driver
- [x] Year-filtered driver dropdown (re-fetches on year change)
- [x] 4 bento cards with MagicBento wrapper:
  - Position Changes — Plotly line chart
  - Team Pace Comparison — Plotly boxplot
  - Tyre Strategies — Plotly stacked horizontal bars
  - Post Qualifying — Plotly horizontal bar chart
- [x] Floating modal for each card
- [x] All 4 APIs fire in parallel on "Analyse"

#### AI Steward (`/steward`)
- [x] Two-column layout (lg+): capabilities sidebar + chat panel
- [x] Categorized suggestion chips (Standings, Comparison, Penalties, Data)
- [x] Welcome state with all capability groups as clickable pills
- [x] Chat message bubbles with Steward header dot + engine badge
- [x] Typing dots animation during loading
- [x] Clear conversation button
- [x] Glassmorphism with darker backgrounds (f1-carbon/80, f1-black/80)
- [x] Lando Norris background image with gradient overlays
- [x] Red ambient glow

#### Driver Detail (`/driver/:code`)
- [x] Career stats, per-season breakdown, team history

#### Circuit Detail (`/circuit/:key`)
- [x] Winners by year, circuit info

#### Constructor Detail (`/constructor/:slug`)
- [x] Per-season results, driver lineup

### Components
- [x] `MagicBento` — animated bento grid wrapper (stars, spotlight, border glow, tilt, magnetism, click ripple)
- [x] `BentoCard` — card with image backdrop + text overlay
- [x] `CurvedLoop` — SVG textPath curved marquee
- [x] `PlotlyChart` — wrapper around `react-plotly.js`
- [x] `LoadingSpinner`
- [x] `ErrorBanner`
- [x] `AiFloatingButton`
- [x] `FormattedText` — bold text rendering from `**` markers
- [x] `Ticker` — live bottom ticker (F1 news feed style)

### Infrastructure
- [x] API client module (`src/api/client.ts`) with typed functions
- [x] TypeScript type definitions (`src/types/index.ts`)
- [x] Tailwind CSS with custom F1 theme (f1-red `#e8002d`, f1-carbon `#1a1a1a`, f1-black `#0a0a0a`)
- [x] Framer Motion page transitions and stagger animations
- [x] Responsive design (mobile hamburger, grid breakpoints, touch-friendly)
- [x] Vite build with lazy-loaded routes

### Caching
- [x] `backend/data/live_season.json` — single-file cache for Live Season page
- [x] 15-day TTL with stale-while-refresh (returns stale instantly, refreshes in background)
- [x] Async background refresh via `asyncio.to_thread` (non-blocking)

### Catalogs (refreshed)
- [x] Valid seasons: 2000–2026 (27 seasons)
- [x] 99 drivers, 43 constructors, 179 aliases

## 🔜 Planned / In Progress

- Real-time data refresh polling (WebSocket or SSE for live session data)
- Tyre strategy chart: stint-level compound overlay on lap data
- Sector comparison view
- Dark/light theme toggle (currently dark-only)
- Race Strategy: driver head-to-head sector breakdown
- Circuit map visualization on Home page
- Mobile-optimized chat for AI Steward sidebar
