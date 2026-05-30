import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import fastf1
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import BASE_DIR, FASTF1_CACHE_DIR, settings
from backend.routers import penalty, query, race, resources


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation
    errors = []
    cache_dir = Path(FASTF1_CACHE_DIR)
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        fastf1.Cache.enable_cache(str(cache_dir))
    except Exception as e:
        errors.append(f"FastF1 cache init failed: {e}")

    data_dir = BASE_DIR / "backend" / "data"
    for fname in ("valid_drivers.json", "valid_constructors.json", "valid_circuits.json", "valid_seasons.json", "aliases.json"):
        fpath = data_dir / fname
        if not fpath.exists():
            errors.append(f"Missing catalog: {fpath}")
        else:
            try:
                json.loads(fpath.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                errors.append(f"Corrupt catalog {fname}: {e}")

    if errors:
        print("STARTUP ERRORS:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)

    yield


app = FastAPI(title="F1nalyse", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resources.router, prefix="/api", tags=["resources"])
app.include_router(query.router, prefix="/api", tags=["query"])
app.include_router(penalty.router, prefix="/api/penalty", tags=["penalty"])
app.include_router(race.router, prefix="/api/race", tags=["race"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}"},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
