"""FastAPI application entry point for power loss calculator."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import calculation, datasheet, export, devices, history, comparison
from .database.connection import init_db

app = FastAPI(
    title="Power Loss Calculator",
    description="功率半导体器件损耗计算工具 - IGBT / SiC MOSFET",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calculation.router, prefix="/api", tags=["calculation"])
app.include_router(datasheet.router, prefix="/api", tags=["datasheet"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(devices.router, prefix="/api", tags=["devices"])
app.include_router(history.router, prefix="/api", tags=["history"])
app.include_router(comparison.router, prefix="/api", tags=["comparison"])


@app.on_event("startup")
async def startup():
    """Initialize database and import builtin devices on first run."""
    init_db()
    try:
        from .database.connection import get_connection
        conn = get_connection()
        count = conn.execute("SELECT COUNT(*) as n FROM device_library WHERE is_builtin = 1").fetchone()["n"]
        conn.close()
        if count == 0:
            from .data.importer import import_builtin_devices
            import_builtin_devices()
    except Exception:
        pass  # Non-fatal — builtins can be imported later


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "1.2.0"}
