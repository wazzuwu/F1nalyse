# Architecture Overview

## System Diagram
```
+-----------------------------------------------------------------+
|                         User Query                              |
|  "How fast was Max than Ham in Miami?"                          |
+--------------------------+--------------------------------------+
                           |
                           v
+-----------------------------------------------------------------+
|                   LLM Router (query.py)                         |
|  1. Receives raw query                                          |
|  2. LLM picks tool from catalog + fills params                  |
|  3. Returns: {tool_name, tool_params}                           |
+--------------------------+--------------------------------------+
                           |
                           v
+-----------------------------------------------------------------+
|              Validator Layer (services/validator.py)            |
|  1. Normalize aliases                                           |
|  2. Check against data catalog                                  |
|  3. Fill defaults                                               |
|  4. Return error with suggestions if invalid                    |
+----------+----------------------------------+-------------------+
           |                                  |
           v                                  v
+---------------------------+   +-------------------------------+
| Engine 1                  |   | Engine 2                      |
| RAG Penalty               |   | Race Intelligence             |
|                           |   |                               |
| /api/penalty/*            |   | /api/race/*                   |
|                           |   |                               |
| ChromaDB                  |   | FastF1 API + Cache            |
| Groq LLM                  |   | Plotly JSON charts            |
+---------------------------+   +-------------------------------+
           |                                  |
           +------------------+---------------+
                              |
                              v
+-----------------------------------------------------------------+
|                   LLM Response Generation                       |
|  Gets tool output -> formats natural language answer            |
|  + embeds Plotly chart references                               |
+-----------------------------------------------------------------+
```

## API Design
- **Single entry point**: `POST /api/query` - raw user query -> LLM routes internally
- **Direct endpoints** (for frontend to call directly):
  - `POST /api/penalty/predict`
  - `POST /api/race/compare`
  - `GET /api/race/summary?circuit=...&year=...`
  - `GET /api/race/standings?year=...`
  - `GET /api/race/telemetry?driver=...&circuit=...`

## Data Catalog
Maintained as JSON files. Refreshed periodically via FastF1 API or manually.

```json
{
  "drivers": {"VER": "Max Verstappen", "HAM": "Lewis Hamilton", ...},
  "circuits": {"miami": "Miami International Autodrome", ...},
  "seasons": [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  "session_types": {"R": "Race", "Q": "Qualifying", "SQ": "Sprint Qualifying", "SPR": "Sprint"},
  "aliases": {"max": "VER", "hamilton": "HAM", "miami gp": "miami", ...}
}
```

## Validator Logic
```
function dispatch(query):
  1. LLM call: tool, params = llm_choose_tool(query, tool_catalog)
  2. For each param:
     - Normalize via aliases
     - Check against valid values in data catalog
     - If invalid -> return structured error "Did you mean X?"
     - If missing optional -> fill default
  3. Execute tool(params)
  4. LLM call: format_response(tool_output, original_query)
  5. Return final answer
```

## File Structure
```
backend/
  main.py                  # FastAPI entry + CORS
  config.py                # Settings + env
  data/
    valid_drivers.json
    valid_circuits.json
    valid_seasons.json
  routers/
    query.py               # LLM router (single entry)
    penalty.py             # Engine 1 endpoints
    race.py                # Engine 2 endpoints
  services/
    validator.py           # Param normalization + validation
    llm_client.py          # Groq LLM wrapper (tool calling)
    rag_engine.py          # Engine 1: ChromaDB + reranker
    fastf1_analyzer.py     # Engine 2: FastF1 operations
    telemetry.py           # Telemetry extraction + charting
    standings_service.py   # Standings extraction
  vector_db/
    build_db.py            # ChromaDB builder
    chunker.py             # Text chunker
  scrapers/
    fia_scraper.py         # Download FIA PDFs
    fia_pdf_parser.py      # Parse PDF -> JSONL
  utils/
    helpers.py
```
