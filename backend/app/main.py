from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.db import engine, Base
from app.routers import tasks, pairs, calibration, export

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        import sys
        print(f"Database initialization warning: {e}", file=sys.stderr)
    yield
    # Shutdown: clean up engine
    await engine.dispose()

app = FastAPI(
    title="RLHF Preference Data Platform",
    description="Internal annotation platform for agent trajectories",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(tasks.router)
app.include_router(pairs.router)
app.include_router(calibration.router)
app.include_router(export.router)

@app.get("/health", status_code=200)
async def health_check():
    """
    Liveness probe. Requires no authentication.
    """
    return {"status": "ok", "healthy": True}
