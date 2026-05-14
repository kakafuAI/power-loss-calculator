"""Comparison analysis API endpoints."""

import json
from fastapi import APIRouter, HTTPException
from ..database import models as db
from ..database.analyzer import compare_calculations

router = APIRouter()


@router.post("/compare")
async def create_comparison(data: dict):
    """Create a comparison between multiple calculations or devices."""
    calc_ids = data.get("calc_ids", [])
    device_ids = data.get("device_ids", [])
    name = data.get("name", "Comparison")

    if len(calc_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 calculation IDs to compare")

    analysis = compare_calculations(calc_ids)

    # Save comparison result
    cmp_id = db.save_comparison(
        name=name,
        device_ids=device_ids,
        calc_ids=calc_ids,
        analysis_json=json.dumps(analysis),
        anomalies_json=json.dumps(analysis.get("significant_differences", [])),
    )

    return {
        "id": cmp_id,
        "analysis": analysis,
    }


@router.get("/compare")
async def list_comparisons(limit: int = 20):
    """List recent comparisons."""
    comparisons = db.list_comparisons(limit=limit)
    return {"comparisons": comparisons}


@router.get("/compare/{cmp_id}")
async def get_comparison(cmp_id: int):
    """Get a specific comparison result."""
    cmp = db.get_comparison(cmp_id)
    if not cmp:
        raise HTTPException(status_code=404, detail="Comparison not found")
    return cmp
