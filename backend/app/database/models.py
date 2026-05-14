"""Data access layer — CRUD operations on SQLite tables."""

import json
import hashlib
import time
from typing import Optional

from .connection import get_connection, dict_from_row


# ── Device Library ────────────────────────────────────────────────────

def list_devices(
    device_type: str | None = None,
    is_builtin: bool | None = None,
    search: str = "",
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    conn = get_connection()
    query = "SELECT * FROM device_library WHERE 1=1"
    params: list = []
    if device_type:
        query += " AND device_type = ?"
        params.append(device_type)
    if is_builtin is not None:
        query += " AND is_builtin = ?"
        params.append(1 if is_builtin else 0)
    if search:
        query += " AND (name LIKE ? OR manufacturer LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    query += " ORDER BY is_builtin DESC, manufacturer, name LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_device(device_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM device_library WHERE id = ?", (device_id,)).fetchone()
    conn.close()
    return dict_from_row(row)


def create_device(
    name: str,
    device_type: str,
    config_json: str,
    manufacturer: str = "",
    vdc_rated: float = 0,
    ic_rated: float = 0,
    is_builtin: bool = False,
    source: str = "manual",
) -> int:
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO device_library (name, manufacturer, device_type, config_json,
           vdc_rated, ic_rated, is_builtin, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, manufacturer, device_type, config_json, vdc_rated, ic_rated,
         1 if is_builtin else 0, source),
    )
    conn.commit()
    device_id = cur.lastrowid
    conn.close()
    return device_id


def update_device(device_id: int, **kwargs) -> bool:
    if not kwargs:
        return False
    conn = get_connection()
    fields = []
    values = []
    for k, v in kwargs.items():
        if k in ("name", "manufacturer", "device_type", "config_json",
                 "vdc_rated", "ic_rated", "is_builtin", "source"):
            fields.append(f"{k} = ?")
            values.append(v)
    if not fields:
        conn.close()
        return False
    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(device_id)
    conn.execute(f"UPDATE device_library SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return True


def delete_device(device_id: int) -> bool:
    conn = get_connection()
    conn.execute("DELETE FROM device_library WHERE id = ? AND is_builtin = 0", (device_id,))
    conn.commit()
    affected = conn.total_changes
    conn.close()
    return affected > 0


# ── Calculation History ───────────────────────────────────────────────

def list_history(
    device_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    conn = get_connection()
    query = "SELECT * FROM calculation_history WHERE 1=1"
    params: list = []
    if device_id:
        query += " AND device_id = ?"
        params.append(device_id)
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_history(calc_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM calculation_history WHERE id = ?", (calc_id,)).fetchone()
    conn.close()
    return dict_from_row(row)


def save_calculation(
    device_id: int | None,
    device_name: str,
    conditions_json: str,
    result_json: str,
    calculation_time_ms: float = 0,
    converged: bool = True,
    t_j_max: float = 0,
    p_total_loss: float = 0,
    efficiency: float = 0,
) -> int:
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO calculation_history
           (device_id, device_name, conditions_json, result_json, calculation_time_ms,
            converged, t_j_max, p_total_loss, efficiency)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (device_id, device_name, conditions_json, result_json, calculation_time_ms,
         1 if converged else 0, t_j_max, p_total_loss, efficiency),
    )
    conn.commit()
    calc_id = cur.lastrowid
    conn.close()
    return calc_id


def update_trust(calc_id: int, trust_score: int, notes: str = "") -> bool:
    conn = get_connection()
    conn.execute(
        "UPDATE calculation_history SET trust_score = ?, notes = ? WHERE id = ?",
        (trust_score, notes, calc_id),
    )
    conn.commit()
    conn.close()
    return True


# ── Comparison Results ─────────────────────────────────────────────────

def save_comparison(
    name: str,
    device_ids: list[int],
    calc_ids: list[int],
    analysis_json: str,
    anomalies_json: str = "[]",
) -> int:
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO comparison_results (name, device_ids, calc_ids, analysis_json, anomalies_json)
           VALUES (?, ?, ?, ?, ?)""",
        (name, json.dumps(device_ids), json.dumps(calc_ids),
         analysis_json, anomalies_json),
    )
    conn.commit()
    cmp_id = cur.lastrowid
    conn.close()
    return cmp_id


def list_comparisons(limit: int = 20) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM comparison_results ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_comparison(cmp_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM comparison_results WHERE id = ?", (cmp_id,)).fetchone()
    conn.close()
    return dict_from_row(row)


# ── Datasheet Cache ────────────────────────────────────────────────────

def cache_datasheet(
    file_hash: str,
    file_name: str,
    device_type: str,
    extracted_json: str,
    confidence_json: str = "{}",
) -> bool:
    conn = get_connection()
    conn.execute(
        """INSERT OR REPLACE INTO datasheet_cache
           (file_hash, file_name, device_type, extracted_json, confidence_json)
           VALUES (?, ?, ?, ?, ?)""",
        (file_hash, file_name, device_type, extracted_json, confidence_json),
    )
    conn.commit()
    conn.close()
    return True


def get_cached_datasheet(file_hash: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM datasheet_cache WHERE file_hash = ?", (file_hash,)
    ).fetchone()
    conn.close()
    return dict_from_row(row)


def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


# ── Knowledge Base ─────────────────────────────────────────────────────

def record_correction(
    device_id: int,
    field_name: str,
    original_value: str,
    corrected_value: str,
    source: str = "manual",
) -> int:
    conn = get_connection()
    # Check if existing correction for same field
    existing = conn.execute(
        "SELECT id, verified_count FROM knowledge_base WHERE device_id = ? AND field_name = ?",
        (device_id, field_name),
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE knowledge_base SET corrected_value = ?, verified_count = verified_count + 1, "
            "correction_source = ? WHERE id = ?",
            (corrected_value, source, existing["id"]),
        )
        conn.commit()
        conn.close()
        return existing["id"]
    cur = conn.execute(
        """INSERT INTO knowledge_base (device_id, field_name, original_value, corrected_value, correction_source)
           VALUES (?, ?, ?, ?, ?)""",
        (device_id, field_name, original_value, corrected_value, source),
    )
    conn.commit()
    kb_id = cur.lastrowid
    conn.close()
    return kb_id


def get_corrections(device_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM knowledge_base WHERE device_id = ? ORDER BY created_at DESC",
        (device_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_knowledge_stats() -> dict:
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) as n FROM knowledge_base").fetchone()["n"]
    by_source = conn.execute(
        "SELECT correction_source, COUNT(*) as n FROM knowledge_base GROUP BY correction_source"
    ).fetchall()
    conn.close()
    return {
        "total_corrections": total,
        "by_source": {r["correction_source"]: r["n"] for r in by_source},
    }
