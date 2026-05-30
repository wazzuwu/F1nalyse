# Frontend Checkpoint

## Stack
- React 19 + TypeScript + Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- Framer Motion (animations, parallax, scroll reveals)
- react-plotly.js (telemetry charts, 4.6MB lazy chunk)
- React Router v7 (4 routes)
- Dev proxy: `/api` → `localhost:8000`

## Routes
| Path | Page | Chunk Size |
|------|------|-----------|
| `/` | Home | 14.8 KB |
| `/live` | Live Season | 6.4 KB |
| `/analysis` | Analysis (4 tabs) | 4,672 KB (Plotly) |
| `/steward` | AI Steward | 5.8 KB |

## Pages Built

### Home (`/`)
- Full-viewport hero with `f1-car.jpg` parallax background (scroll at 30% speed)
- Dark gradient overlay (left solid → right transparent) + bottom fade
- Title + subtitle + 2 CTA buttons (Live Season, Analysis)
- 3 feature cards with staggered entry animation
- Quick Race Browser: year/circuit selects → top 5 results table with fastest lap

### Live Season (`/live`)
- 2026 hardcoded (no year selector)
- 2-column layout: left (latest race + calendar), right (driver standings top 10 + constructor standings top 5)
- Refresh button with loading state

### Analysis (`/analysis`)
- Sticky tab bar at `top-20` with active pill style
- 4 tabs with consistent redesign:

  **CompareTab** — Up to 3 drivers, circuit/year selects, quali toggle. Results in gradient cards with stat rows (position, fastest lap, avg lap, pit stops, laps led, consistency). Driver selection via pill buttons with active state.

  **TelemetryTab** — Driver/circuit/year/metric/compare selects. 5 stat cards (avg/top/min speed, avg throttle/brake). Plotly chart in glass container with red accent header.

  **LapsTab** — Driver/circuit/year/max-laps controls. Scrollable table with compound color badges (SOFT=red, MEDIUM=yellow, HARD=blue, INTERMEDIATE=green, WET=purple). Fastest lap highlighted with red gradient row + "FL" tag.

  **PenaltyTab** — Textarea with example chips that fill the input (e.g. "kimi raikkonen gearbox change italian gp"). Submits to `/api/query`. Result in steward decision card with avatar + engine badge.

### AI Steward (`/steward`)
- Full-bleed Lando Norris background image (`lando.jpg`, 1.9MB)
- Dark gradient overlays + red ambient glow
- Title top-left
- Floating glass chat panel: `w-[clamp(320px,35vw,460px)] aspect-[3/5] max-h-[calc(100vh-160px)]`
  - `backdrop-blur-2xl` heavy glassmorphism
  - `rounded-3xl` + deep shadow
  - Centered vertically/horizontally
  - Online indicator + message count in header
  - Scrollable messages with auto-scroll
  - User: gradient red bubbles; AI: glass bubbles with engine badge
  - Typing dots animation during loading
  - Suggestion chips (5 prompts) shown initially
  - Input bar with send button + arrow icon

## Components
- **Navbar** — `h-20` (80px), frosted glass on scroll, Inter font, 4 links (Home, Live Season, Analysis, AI Steward), mobile hamburger
- **Ticker** — Fixed bottom marquee (40s loop), 3 rotating F1 messages
- **AiFloatingButton** — Hexagonal FAB (AI), slide-out panel, reuses `/api/query`, available on all pages
- **PlotlyChart** — Wraps react-plotly.js with transparent theme, responsive
- **LoadingSpinner** — Animated spinner + optional text
- **ErrorBanner** — Dismissible error message

## Design System
- Colors: `f1-black (#0a0a0a)`, `f1-red (#e8002d)`, `f1-silver (#c0c0c0)`, `f1-carbon (#1a1a1a)`
- Font: **Inter** (body + headings, weights 300-900)
- Gradient buttons: `from-f1-red to-red-700` with hover scale + shadow glow
- Glass cards: `backdrop-blur-xl`, `border border-white/5`, `rounded-2xl`
- Filter panels: `bg-gradient-to-br from-f1-carbon to-black`, `rounded-2xl`
- All selects/inputs: `rounded-xl`, `focus:border-f1-red/50`, `focus:ring-1`

## API Client (`api/client.ts`)
- 8 functions: `getDrivers`, `getCircuits`, `getSeasons`, `getRaceResults`, `getStandings`, `postCompare`, `postLaps`, `postTelemetry`, `postQuery`
- All proxy through `/api` → backend on `localhost:8000`
- Generic `fetchJSON<T>` with error handling

## Assets
- `f1-car.jpg` (1.15 MB) — Home hero background
- `lando.jpg` (1.97 MB) — AI Steward full-page background
- `driver.jpg`, `hero.png`, `2026mercedesgeorus01right.avif` — available

## Performance
- Route-level code splitting (lazy + Suspense)
- Plotly (4.6MB) only loaded on `/analysis`
- Home chunk: 14.8 KB (lightweight)
- Steward chunk: 5.8 KB (lightweight)
- Custom cursor removed (native cursor restored)
- Scroll listener throttled via `requestAnimationFrame` + `passive: true`
- Navbar scroll handler uses `rAF` tick

## What's Missing / Next
- Mobile responsiveness polish (tables overflow, tab wrapping)
- Animations: Framer Motion scroll reveals on section entries, parallax depth on hero
- Live Season: year selector, real data fetching from backend
- Analysis: error states for each tab, loading skeletons
- AI Steward: message persistence, streaming responses
- Plotly: lazy-load within Analysis page (code-split further)
- Accessibility: aria labels, focus management, semantic HTML
- Production: verify proxy works with running backend, build deploy config
