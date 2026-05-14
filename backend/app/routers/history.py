"""Calculation history and knowledge base API endpoints."""

import json
import time
from fastapi import APIRouter, HTTPException, Query
from ..database import models as db
from ..database.analyzer import detect_anomalies

router = APIRouter()


@router.get("/history")
async def list_history(
    device_id: int | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
):
    """List calculation history."""
    return {
        "history": db.list_history(device_id=device_id, limit=limit, offset=offset),
    }


@router.get("/history/{calc_id}")
async def get_history(calc_id: int):
    """Get a single calculation record."""
    rec = db.get_history(calc_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    return rec


@router.post("/history")
async def save_calculation(data: dict):
    """Save a calculation result to history, with automatic anomaly detection."""
    t0 = time.time()
    calc_id = db.save_calculation(
        device_id=data.get("device_id"),
        device_name=data.get("device_name", ""),
        conditions_json=json.dumps(data.get("conditions", {})),
        result_json=json.dumps(data.get("result", {})),
        calculation_time_ms=data.get("calculation_time_ms", 0),
        converged=data.get("converged", True),
        t_j_max=data.get("t_j_max", 0),
        p_total_loss=data.get("p_total_loss", 0),
        efficiency=data.get("efficiency", 0),
    )
    elapsed = (time.time() - t0) * 1000

    # Auto-detect anomalies
    anomalies = detect_anomalies(calc_id)

    return {
        "id": calc_id,
        "anomalies": anomalies,
        "anomaly_count": len(anomalies),
        "save_time_ms": round(elapsed, 1),
    }


@router.put("/history/{calc_id}/trust")
async def update_trust(calc_id: int, data: dict):
    """Update trust score and notes for a calculation."""
    trust = data.get("trust_score", 3)
    notes = data.get("notes", "")
    if not 1 <= trust <= 5:
        raise HTTPException(status_code=400, detail="trust_score must be 1-5")
    db.update_trust(calc_id, trust, notes)
    return {"status": "updated"}


@router.get("/anomalies")
async def list_anomalies(limit: int = Query(20, le=100)):
    """List recent comparison results that contain anomalies."""
    comparisons = db.list_comparisons(limit=limit)
    anomalous = []
    for c in comparisons:
        anomalies = json.loads(c.get("anomalies_json", "[]"))
        if anomalies:
            anomalous.append({
                "comparison_id": c["id"],
                "name": c["name"],
                "anomalies": anomalies,
                "created_at": c["created_at"],
            })
    return {"anomalies": anomalous}


@router.get("/knowledge/stats")
async def knowledge_stats():
    """Get knowledge base statistics."""
    return db.get_knowledge_stats()


@router.post("/knowledge/correction")
async def record_correction(data: dict):
    """Record a parameter correction in the knowledge base."""
    kb_id = db.record_correction(
        device_id=data.get("device_id", 0),
        field_name=data.get("field_name", ""),
        original_value=str(data.get("original_value", "")),
        corrected_value=str(data.get("corrected_value", "")),
        source=data.get("source", "manual"),
    )
    return {"id": kb_id}
