"""FastAPI application entry point for power loss calculator."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import calculation, datasheet, export

app = FastAPI(
    title="Power Loss Calculator",
    description="功率半导体器件损耗计算工具 - IGBT / SiC MOSFET",
    version="0.1.0",
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


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
