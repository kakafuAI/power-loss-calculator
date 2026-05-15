"""FastAPI application entry point for power loss calculator."""

import os
from pathlib import Path

# Load .env file before other imports
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _val = _line.split("=", 1)
                os.environ.setdefault(_key.strip(), _val.strip())

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path

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


# ──────────────────────────────────────────
# Serve built frontend (production deployment)
# ──────────────────────────────────────────
# This MUST be mounted AFTER API routes so /api/* takes priority
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    from fastapi.staticfiles import StaticFiles

    class SPARouter(StaticFiles):
        """SPA fallback: for non-existing files, serve index.html."""
        async def get_response(self, path: str, scope):
            try:
                return await super().get_response(path, scope)
            except (HTTPException, Exception):
                return FileResponse(str(FRONTEND_DIST / "index.html"))

    app.mount("/", SPARouter(directory=str(FRONTEND_DIST), html=True), name="frontend")
    print(f"✅ 前端静态文件已加载: {FRONTEND_DIST}")
else:
    print(f"⚠️  前端构建产物不存在 ({FRONTEND_DIST})，请先执行: cd frontend && npm run build")
