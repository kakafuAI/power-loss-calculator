"""Anomaly detection and cross-comparison analysis."""

import json
import statistics
from .connection import get_connection


def detect_anomalies(calc_id: int) -> list[dict]:
    """
    Run anomaly detection checks on a newly saved calculation.

    Returns list of anomaly dicts with: type, severity, message, details
    """
    anomalies = []
    conn = get_connection()

    # Get the new calculation
    calc = conn.execute(
        "SELECT * FROM calculation_history WHERE id = ?", (calc_id,)
    ).fetchone()
    if not calc:
        conn.close()
        return anomalies

    calc = dict(calc)
    result = json.loads(calc["result_json"])
    conditions = json.loads(calc["conditions_json"])

    # ── Check 1: Physical plausibility ──────────────────────────────
    efficiency = calc["efficiency"]
    if efficiency > 99.9:
        anomalies.append({
            "type": "physical_implausible",
            "severity": "high",
            "message": f"效率 {efficiency:.2f}% 异常偏高，可能参数输入有误",
            "details": "效率接近或超过 100%，请检查输入参数",
        })
    if efficiency < 50:
        anomalies.append({
            "type": "physical_implausible",
            "severity": "high",
            "message": f"效率 {efficiency:.1f}% 异常偏低",
            "details": "效率低于 50%，检查热阻参数或工况是否合理",
        })

    t_j_max = calc["t_j_max"]
    if t_j_max > 250:
        anomalies.append({
            "type": "tj_excessive",
            "severity": "high",
            "message": f"最大结温 {t_j_max:.1f}°C 已严重超过安全工作范围",
            "details": "Tj 被钳位于 250°C，实际散热条件无法满足要求，需降低损耗或改善散热",
        })

    # ── Check 2: Compare with same-device history ───────────────────
    if calc["device_id"]:
        same_device = conn.execute(
            """SELECT p_total_loss, efficiency, t_j_max
               FROM calculation_history
               WHERE device_id = ? AND id != ?
               ORDER BY created_at DESC LIMIT 10""",
            (calc["device_id"], calc_id),
        ).fetchall()

        if len(same_device) >= 2:
            losses = [r["p_total_loss"] for r in same_device]
            mean_loss = statistics.mean(losses)
            stdev_loss = statistics.stdev(losses) if len(losses) >= 2 else 0

            if stdev_loss > 0 and abs(calc["p_total_loss"] - mean_loss) > 2 * stdev_loss:
                anomalies.append({
                    "type": "historical_deviation",
                    "severity": "medium",
                    "message": f"总损耗 {calc['p_total_loss']:.1f}W 与历史均值 {mean_loss:.1f}W 偏差超过 2σ",
                    "details": f"该器件历史 {len(same_device)} 次计算，均值 {mean_loss:.0f}W，标准差 {stdev_loss:.0f}W",
                })

    # ── Check 3: Compare with similar devices ────────────────────────
    if calc["device_id"]:
        dev = conn.execute("SELECT * FROM device_library WHERE id = ?", (calc["device_id"],)).fetchone()
        if dev:
            dev = dict(dev)
            similar = conn.execute(
                """SELECT id, name, manufacturer FROM device_library
                   WHERE device_type = ? AND vdc_rated = ? AND id != ?
                   LIMIT 5""",
                (dev["device_type"], dev["vdc_rated"], calc["device_id"]),
            ).fetchall()

            for s in similar:
                s_calcs = conn.execute(
                    """SELECT p_total_loss, efficiency FROM calculation_history
                       WHERE device_id = ? ORDER BY created_at DESC LIMIT 1""",
                    (s["id"],),
                ).fetchall()
                for sc in s_calcs:
                    loss_diff_pct = abs(calc["p_total_loss"] - sc["p_total_loss"]) / max(sc["p_total_loss"], 1) * 100
                    if loss_diff_pct > 50:
                        anomalies.append({
                            "type": "cross_device_deviation",
                            "severity": "medium",
                            "message": f"与相似器件 {s['name']} 损耗差异 {loss_diff_pct:.0f}%",
                            "details": f"当前 {calc['p_total_loss']:.0f}W vs {s['name']} {sc['p_total_loss']:.0f}W",
                        })

    conn.close()
    return anomalies


def compare_calculations(calc_ids: list[int]) -> dict:
    """
    Generate a structured comparison analysis for multiple calculations.

    Returns analysis dict with per-metric comparisons and anomaly flags.
    """
    conn = get_connection()
    records = []
    for cid in calc_ids:
        row = conn.execute("SELECT * FROM calculation_history WHERE id = ?", (cid,)).fetchone()
        if row:
            records.append(dict(row))
    conn.close()

    if len(records) < 2:
        return {"error": "Need at least 2 calculations to compare"}

    metrics = {
        "p_total_loss": {"label": "总损耗 (W)", "lower_is_better": True},
        "efficiency": {"label": "效率 (%)", "lower_is_better": False},
        "t_j_max": {"label": "最高结温 (°C)", "lower_is_better": True},
    }

    comparisons = []
    for key, meta in metrics.items():
        values = [r[key] for r in records if r.get(key) is not None]
        if len(values) < 2:
            continue
        best_val = min(values) if meta["lower_is_better"] else max(values)
        worst_val = max(values) if meta["lower_is_better"] else min(values)
        spread_pct = abs(worst_val - best_val) / max(abs(best_val), 1) * 100

        comparisons.append({
            "metric": key,
            "label": meta["label"],
            "values": values,
            "best": best_val,
            "worst": worst_val,
            "spread_pct": round(spread_pct, 1),
            "significant": spread_pct > 10,
        })

    return {
        "devices": [r.get("device_name", f"ID:{r['id']}") for r in records],
        "calc_ids": calc_ids,
        "comparisons": comparisons,
        "significant_differences": [c for c in comparisons if c["significant"]],
    }
