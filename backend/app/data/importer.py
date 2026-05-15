"""Import builtin benchmark devices from JSON to SQLite on first run."""

import json
from pathlib import Path
from ..database.connection import get_connection
from ..database.models import create_device


BUILTIN_PATH = Path(__file__).parent / "builtin_devices.json"


def import_builtin_devices():
    """Import all builtin devices from the JSON catalog into the database."""
    if not BUILTIN_PATH.exists():
        return

    with open(BUILTIN_PATH) as f:
        catalog = json.load(f)

    devices = catalog.get("devices", [])
    imported = 0

    for dev in devices:
        create_device(
            name=dev["name"],
            device_type=dev["device_type"],
            config_json=json.dumps(dev["config"]),
            manufacturer=dev.get("manufacturer", ""),
            vdc_rated=dev.get("vdc_rated", 0),
            ic_rated=dev.get("ic_rated", 0),
            is_builtin=True,
            source="builtin",
        )
        imported += 1

    # Pre-compute benchmark results at standard conditions
    try:
        _precompute_benchmarks()
    except Exception:
        pass  # Non-fatal

    return imported


def _precompute_benchmarks():
    """Pre-compute loss for each builtin device at standard test conditions."""
    from ..engine.topology import InverterConfig, OperatingPoint, calculate_inverter_losses
    from ..engine.switching import create_energy_lookup

    conn = get_connection()
    builtins = conn.execute(
        "SELECT id, name, config_json FROM device_library WHERE is_builtin = 1"
    ).fetchall()

    # Standard test conditions
    conditions_list = [
        {"label": "轻载 25%", "i_out_rms_factor": 0.25},
        {"label": "半载 50%", "i_out_rms_factor": 0.50},
        {"label": "额定 100%", "i_out_rms_factor": 1.00},
    ]

    for dev in builtins:
        config_dict = json.loads(dev["config_json"])
        ic_rated = config_dict.get("ic_rated", 100)
        vdc_rated = config_dict.get("vdc_rated", 600)

        for cond in conditions_list:
            try:
                i_rms = ic_rated * cond["i_out_rms_factor"]
                # Build engine config
                eng_config = _build_engine_config(config_dict)
                op = OperatingPoint(
                    vdc=vdc_rated * 0.5,  # Typical: Vdc = half rated
                    i_out_rms=i_rms,
                    f_out=50, f_sw=4000,
                    m=1.0, cos_phi=0.85, t_ambient=40,
                )
                result = calculate_inverter_losses(eng_config, op, include_steps=False)

                # Save as a pre-computed calculation
                conn.execute(
                    """INSERT INTO calculation_history
                       (device_id, device_name, conditions_json, result_json,
                        converged, t_j_max, p_total_loss, efficiency)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        dev["id"], f"{dev['name']} [{cond['label']}]",
                        json.dumps({"vdc": op.vdc, "i_out_rms": op.i_out_rms,
                                    "f_sw": op.f_sw, "label": cond["label"]}),
                        json.dumps(result),
                        1 if result["converged"] else 0,
                        result["t_j_max"],
                        result["p_total_loss"],
                        result["efficiency"],
                    ),
                )
            except Exception:
                continue

    conn.commit()
    conn.close()


def _normalize_pts(pts: list) -> list[tuple]:
    """Normalize points to [(current, energy), ...] regardless of format."""
    result = []
    for p in pts:
        if hasattr(p, 'current') and hasattr(p, 'energy'):
            result.append((float(p.current), float(p.energy)))
        elif isinstance(p, dict):
            result.append((p.get("current", 0), p.get("energy", 0)))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            result.append((float(p[0]), float(p[1])))
    return result


def _build_engine_config(config_dict: dict) -> "InverterConfig":
    """Build InverterConfig from a stored config dict."""
    from ..engine.topology import InverterConfig

    is_sic = "sic" in config_dict.get("device_type", "")

    igbt = config_dict.get("igbt") or {}
    diode = config_dict.get("diode") or {}
    sic_mos = config_dict.get("sic_mos") or {}
    sic_diode = config_dict.get("sic_diode") or {}

    eon_pts = []
    eoff_pts = []
    err_pts = []

    if is_sic and sic_mos:
        eon_curve = sic_mos.get("eon_curve", {})
        eoff_curve = sic_mos.get("eoff_curve", {})
        eon_pts = _normalize_pts(eon_curve.get("points", []))
        eoff_pts = _normalize_pts(eoff_curve.get("points", []))
        if sic_diode and sic_diode.get("err_curve"):
            err_pts = _normalize_pts(sic_diode["err_curve"].get("points", []))

        return InverterConfig(
            is_sic=True,
            vce_sat_25=0, vce_sat_125=0,
            ic_nom=sic_mos.get("id_nom", 100),
            vce_rated=sic_mos.get("vds_rated", 1200),
            rds_on_25=sic_mos.get("rds_on_25", 20),
            rds_on_125=sic_mos.get("rds_on_125", 35),
            vsd_25=(sic_diode or {}).get("vsd_25", 1.5),
            vsd_125=(sic_diode or {}).get("vsd_125", 1.3),
            eon_points=eon_pts, eoff_points=eoff_pts, err_points=err_pts,
            eon_vcc_ref=eon_curve.get("vcc", 800),
            eoff_vcc_ref=eoff_curve.get("vcc", 800),
            rg_int=(sic_mos.get("rg_int") or 0),
            vf_25=0, vf_125=0,
            rth_jc_igbt=(sic_mos.get("thermal") or {}).get("rth_jc", 0.2),
            rth_jc_diode=(sic_diode.get("thermal") or {}).get("rth_jc", 0.3),
            rth_ch=config_dict.get("rth_ch_module", 0.02),
            rth_ha=config_dict.get("rth_ha", 0.08),
        )

    # IGBT
    eon_curve = igbt.get("eon_curve", {})
    eoff_curve = igbt.get("eoff_curve", {})
    eon_pts = _normalize_pts(eon_curve.get("points", []))
    eoff_pts = _normalize_pts(eoff_curve.get("points", []))
    if diode and diode.get("err_curve"):
        err_pts = _normalize_pts(diode["err_curve"].get("points", []))

    return InverterConfig(
        vce_sat_25=igbt.get("vce_sat_25", 1.7),
        vce_sat_125=igbt.get("vce_sat_125", 2.0),
        ic_nom=igbt.get("ic_nom", 100),
        vce_rated=igbt.get("vce_rated", 1200),
        eon_points=eon_pts, eoff_points=eoff_pts, err_points=err_pts,
        eon_vcc_ref=eon_curve.get("vcc", 600),
        eoff_vcc_ref=eoff_curve.get("vcc", 600),
        rg_int=(igbt.get("rg_int") or 0),
        vf_25=diode.get("vf_25", 1.8),
        vf_125=diode.get("vf_125", 1.6),
        rth_jc_igbt=(igbt.get("thermal") or {}).get("rth_jc", 0.24),
        rth_jc_diode=(diode.get("thermal") or {}).get("rth_jc", 0.42),
        rth_ch=config_dict.get("rth_ch_module", 0.02),
        rth_ha=config_dict.get("rth_ha", 0.08),
    )
