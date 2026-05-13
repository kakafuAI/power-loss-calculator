"""Characteristic curve generation via parametric sweeps."""

import numpy as np
from .topology import InverterConfig, OperatingPoint, calculate_inverter_losses


def sweep_output_current(
    config: InverterConfig,
    base_op: OperatingPoint,
    i_min: float = 1.0,
    i_max: float = None,
    n_points: int = 50,
) -> dict:
    """Generate loss vs output current curve."""
    if i_max is None:
        i_max = base_op.i_out_rms * 2.0
    currents = np.linspace(i_min, i_max, n_points)

    total_loss = []
    igbt_cond = []
    igbt_sw = []
    diode_cond = []
    diode_sw = []
    t_j_max_vals = []
    efficiency_vals = []

    for i_rms in currents:
        op = OperatingPoint(
            vdc=base_op.vdc, i_out_rms=float(i_rms),
            f_out=base_op.f_out, f_sw=base_op.f_sw,
            m=base_op.m, cos_phi=base_op.cos_phi,
            t_ambient=base_op.t_ambient,
        )
        res = calculate_inverter_losses(config, op, include_steps=False)
        total_loss.append(res["p_total_loss"])
        igbt_cond.append(res["p_igbt_cond"])
        igbt_sw.append(res["p_igbt_sw"])
        diode_cond.append(res["p_diode_cond"])
        diode_sw.append(res["p_diode_sw"])
        t_j_max_vals.append(res["t_j_max"])
        efficiency_vals.append(res["efficiency"])

    return {
        "curves": [
            {"name": "Total Loss", "x_label": "Output RMS Current (A)", "y_label": "Loss (W)",
             "points": [{"x": round(float(c), 2), "y": round(float(l), 2)} for c, l in zip(currents, total_loss)]},
            {"name": "IGBT Conduction Loss", "x_label": "Output RMS Current (A)", "y_label": "Loss (W)",
             "points": [{"x": round(float(c), 2), "y": round(float(l), 2)} for c, l in zip(currents, igbt_cond)]},
            {"name": "IGBT Switching Loss", "x_label": "Output RMS Current (A)", "y_label": "Loss (W)",
             "points": [{"x": round(float(c), 2), "y": round(float(l), 2)} for c, l in zip(currents, igbt_sw)]},
            {"name": "Diode Conduction Loss", "x_label": "Output RMS Current (A)", "y_label": "Loss (W)",
             "points": [{"x": round(float(c), 2), "y": round(float(l), 2)} for c, l in zip(currents, diode_cond)]},
            {"name": "Diode Switching Loss", "x_label": "Output RMS Current (A)", "y_label": "Loss (W)",
             "points": [{"x": round(float(c), 2), "y": round(float(l), 2)} for c, l in zip(currents, diode_sw)]},
            {"name": "Efficiency", "x_label": "Output RMS Current (A)", "y_label": "Efficiency (%)",
             "points": [{"x": round(float(c), 2), "y": round(float(e), 2)} for c, e in zip(currents, efficiency_vals)]},
            {"name": "Tj_max", "x_label": "Output RMS Current (A)", "y_label": "Max Junction Temp (°C)",
             "points": [{"x": round(float(c), 2), "y": round(float(t), 2)} for c, t in zip(currents, t_j_max_vals)]},
        ]
    }


def sweep_switching_frequency(
    config: InverterConfig,
    base_op: OperatingPoint,
    f_min: float = 1000.0,
    f_max: float = 20000.0,
    n_points: int = 50,
) -> dict:
    """Generate loss vs switching frequency curve."""
    freqs = np.linspace(f_min, f_max, n_points)

    total_loss = []
    igbt_sw = []
    diode_sw = []
    igbt_cond = []
    diode_cond = []
    t_j_max_vals = []

    for f_sw in freqs:
        op = OperatingPoint(
            vdc=base_op.vdc, i_out_rms=base_op.i_out_rms,
            f_out=base_op.f_out, f_sw=float(f_sw),
            m=base_op.m, cos_phi=base_op.cos_phi,
            t_ambient=base_op.t_ambient,
        )
        res = calculate_inverter_losses(config, op, include_steps=False)
        total_loss.append(res["p_total_loss"])
        igbt_sw.append(res["p_igbt_sw"])
        diode_sw.append(res["p_diode_sw"])
        igbt_cond.append(res["p_igbt_cond"])
        diode_cond.append(res["p_diode_cond"])
        t_j_max_vals.append(res["t_j_max"])

    return {
        "curves": [
            {"name": "Total Loss", "x_label": "Switching Frequency (kHz)", "y_label": "Loss (W)",
             "points": [{"x": round(float(f)/1000, 2), "y": round(float(l), 2)} for f, l in zip(freqs, total_loss)]},
            {"name": "IGBT Switching Loss", "x_label": "Switching Frequency (kHz)", "y_label": "Loss (W)",
             "points": [{"x": round(float(f)/1000, 2), "y": round(float(l), 2)} for f, l in zip(freqs, igbt_sw)]},
            {"name": "Diode Switching Loss", "x_label": "Switching Frequency (kHz)", "y_label": "Loss (W)",
             "points": [{"x": round(float(f)/1000, 2), "y": round(float(l), 2)} for f, l in zip(freqs, diode_sw)]},
            {"name": "IGBT Conduction Loss", "x_label": "Switching Frequency (kHz)", "y_label": "Loss (W)",
             "points": [{"x": round(float(f)/1000, 2), "y": round(float(l), 2)} for f, l in zip(freqs, igbt_cond)]},
            {"name": "Tj_max", "x_label": "Switching Frequency (kHz)", "y_label": "Max Junction Temp (°C)",
             "points": [{"x": round(float(f)/1000, 2), "y": round(float(t), 2)} for f, t in zip(freqs, t_j_max_vals)]},
        ]
    }


def sweep_power_factor(
    config: InverterConfig,
    base_op: OperatingPoint,
    n_points: int = 50,
) -> dict:
    """Generate loss vs power factor curve."""
    pf_vals = np.linspace(0.1, 1.0, n_points)

    total_loss = []
    efficiency_vals = []
    t_j_max_vals = []

    for pf in pf_vals:
        op = OperatingPoint(
            vdc=base_op.vdc, i_out_rms=base_op.i_out_rms,
            f_out=base_op.f_out, f_sw=base_op.f_sw,
            m=base_op.m, cos_phi=float(pf),
            t_ambient=base_op.t_ambient,
        )
        res = calculate_inverter_losses(config, op, include_steps=False)
        total_loss.append(res["p_total_loss"])
        efficiency_vals.append(res["efficiency"])
        t_j_max_vals.append(res["t_j_max"])

    return {
        "curves": [
            {"name": "Total Loss", "x_label": "Power Factor cosφ", "y_label": "Loss (W)",
             "points": [{"x": round(float(p), 3), "y": round(float(l), 2)} for p, l in zip(pf_vals, total_loss)]},
            {"name": "Efficiency", "x_label": "Power Factor cosφ", "y_label": "Efficiency (%)",
             "points": [{"x": round(float(p), 3), "y": round(float(e), 2)} for p, e in zip(pf_vals, efficiency_vals)]},
            {"name": "Tj_max", "x_label": "Power Factor cosφ", "y_label": "Max Junction Temp (°C)",
             "points": [{"x": round(float(p), 3), "y": round(float(t), 2)} for p, t in zip(pf_vals, t_j_max_vals)]},
        ]
    }
