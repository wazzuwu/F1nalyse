# Query Examples by Engine

## Engine 1 - RAG Penalty Predictor

| User Query | Parsed Intent | Tool Call | Expected Output |
|---|---|---|---|
| "What penalty would VER get for forcing HAM off track?" | penalty prediction | `predict_penalty("VER forced HAM off track")` | "Likely 5s penalty. Precedent: 2021 Monza VER-HAM similar incident -> 5s penalty." |
| "Would this be a race ban? VER clipped NOR at T1 causing puncture." | penalty prediction | `predict_penalty("VER clipped NOR at T1, puncture")` | "Probably race ban. Precedent: 2012 Schumacher similar -> 10-place grid drop." |
| "How many penalty points for a pit lane infringement?" | penalty prediction | `predict_penalty("pit lane infringement")` | "Typically 2 penalty points. Precedent: ..." |

## Engine 2 - Race Intelligence

| User Query | Parsed Intent | Tool Call | Expected Output |
|---|---|---|---|
| "How fast was Max than Ham in Miami?" | driver comparison | `compare_drivers("VER", "HAM", "miami")` | "VER avg 0.342s faster per lap. Top speed: VER 342.1 vs HAM 338.7 km/h." |
| "Show me the race results for Monaco 2024" | race summary | `get_race_summary("monaco", 2024)` | "1. LEC, 2. NOR +0.8s, 3. SAI +2.3s. Fastest lap: HAM 1:15.2" |
| "Who's leading the championship?" | standings | `get_standings(2025)` | "1. VER 187pts, 2. NOR 156pts, 3. LEC 132pts" |
| "Compare VER and NOR telemetry in sector 2 of Suzuka" | telemetry slice | `get_telemetry_slice("VER", "suzuka", session="Q", lap=3, metric="speed")` | "VER speed: avg 285 km/h, NOR: avg 278 km/h [chart]" |
| "How many pit stops did RUS have in Silverstone?" | driver comparison (with pit stats) | `compare_drivers("RUS", null, "silverstone", session="R")` | "RUS had 2 pit stops, avg 24.3s total" |

## Multi-Engine / Combined

| User Query | Parsed Intent | Tool Calls | Expected Output |
|---|---|---|---|
| "VER just crashed into NOR at T1 - what happened in the race and what penalty?" | race summary + penalty | `get_race_summary("current_gp")` + `predict_penalty(...)` | "VER crashed into NOR at T1. Race result: NOR DNF. Likely penalty: 10s." |

## Error Handling Examples

| User Query | Issue | Response |
|---|---|---|
| "How fast was Max in Mars?" | Circuit "mars" not found | "Circuit 'mars' not found. Valid circuits: monza, miami, silverstone, suzuka, spielberg, ..." |
| "Compare VER vs ALO in 2026" | Year 2026 not available | "Data only available for seasons 2018-2025." |
| "What penalty for crashing in Nascar?" | Not F1-related | "I can only answer F1-related questions (penalties, race data, standings)." |

## Default Behavior
- **Year**: auto-fills to current season (2025)
- **Session**: auto-fills to Race (R)
- **Circuit**: required for comparison/summary tools
- **Driver codes**: must be 3-letter codes or recognized aliases
