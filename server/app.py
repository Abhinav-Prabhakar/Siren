"""SIREN FastAPI backend.

Run from server/:  uvicorn app:app --port 8000

Routers under routers/ are auto-discovered: every module exposing a top-level
`router` is mounted — so server/routers/vapi.py (owned by the Vapi agent) is
picked up without touching this file.
"""
import asyncio
import importlib
import pkgutil
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure server/ is importable regardless of cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from seed import seed_if_empty
from simulator import telemetry_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_if_empty()
    task = asyncio.create_task(telemetry_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="SIREN API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _mount_routers() -> None:
    """Import every module in the routers package and include its `router`."""
    pkg_name = None
    for candidate in ("routers", "server.routers"):
        try:
            pkg = importlib.import_module(candidate)
            pkg_name = candidate
            break
        except ImportError:
            continue
    if pkg_name is None:
        raise RuntimeError("could not import routers package")
    for info in pkgutil.iter_modules(pkg.__path__):
        module = importlib.import_module(f"{pkg_name}.{info.name}")
        if hasattr(module, "router"):
            app.include_router(module.router)


_mount_routers()
