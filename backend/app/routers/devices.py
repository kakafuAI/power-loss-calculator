"""Device library API endpoints."""

from fastapi import APIRouter, HTTPException, Query
from ..database import models as db

router = APIRouter()


@router.get("/devices")
async def list_devices(
    device_type: str | None = Query(None),
    builtin: bool | None = Query(None),
    search: str = Query(""),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
):
    """List devices in the library with optional filtering."""
    return {
        "devices": db.list_devices(
            device_type=device_type,
            is_builtin=builtin,
            search=search,
            limit=limit,
            offset=offset,
        ),
    }


@router.get("/devices/{device_id}")
async def get_device(device_id: int):
    """Get a single device by ID."""
    dev = db.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return dev


@router.post("/devices")
async def create_device(data: dict):
    """Save a new device to the library."""
    device_id = db.create_device(
        name=data.get("name", ""),
        device_type=data.get("device_type", "igbt_module"),
        config_json=data.get("config_json", "{}"),
        manufacturer=data.get("manufacturer", ""),
        vdc_rated=data.get("vdc_rated", 0),
        ic_rated=data.get("ic_rated", 0),
        is_builtin=data.get("is_builtin", False),
        source=data.get("source", "manual"),
    )
    return {"id": device_id}


@router.put("/devices/{device_id}")
async def update_device(device_id: int, data: dict):
    """Update a device's parameters."""
    ok = db.update_device(device_id, **data)
    if not ok:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    return {"status": "updated"}


@router.delete("/devices/{device_id}")
async def delete_device(device_id: int):
    """Delete a non-builtin device."""
    ok = db.delete_device(device_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Device not found or is builtin")
    return {"status": "deleted"}
