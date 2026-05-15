"""Three-phase two-level inverter topology loss aggregation."""

import numpy as np
from dataclasses import dataclass, field

from .conduction import (
    igbt_conduction_loss, diode_conduction_loss, sic_conduction_loss,
    vce_sat_at_temp, vf_at_temp, rds_on_at_temp,
)
from .switching import create_energy_lookup, compute_switching_loss
from .thermal import ThermalSystem, ThermalState, thermal_iteration


VE_SAFE = 1e-9


@dataclass
class InverterConfig:
    """Configuration for a three-phase two-level inverter."""
    # IGBT params
    vce_sat_25: float
    vce_sat_125: float
    ic_nom: float
    vce_rated: float
    eon_points: list   # list of (Ic, Eon) tuples
    eoff_points: list  # list of (Ic, Eoff) tuples
    eon_vcc_ref: float = 600.0
    eoff_vcc_ref: float = 600.0
    eon_rg_ref: float = 10.0
    eoff_rg_ref: float = 10.0
    rg_int: float = 0.0
    rg_ext: float = 10.0

    # Diode params
    vf_25: float = 1.7
    vf_125: float = 1.5
    err_points: list = field(default_factory=list)  # (If, Err) tuples
    err_vcc_ref: float = 600.0

    # Thermal
    rth_jc_igbt: float = 0.3
    rth_jc_diode: float = 0.5
    rth_ch: float = 0.05
    rth_ha: float = 0.5

    # SiC variant
    is_sic: bool = False
    rds_on_25: float = 0.0     # mΩ
    rds_on_125: float = 0.0
    vsd_25: float = 0.0
    vsd_125: float = 0.0

    # Brake chopper
    has_brake: bool = False
    brake_vce_sat_25: float = 0.0
    brake_vce_sat_125: float = 0.0
    brake_vf_25: float = 0.0
    brake_vf_125: float = 0.0
    brake_rth_jc_igbt: float = 0.0
    brake_rth_jc_diode: float = 0.0

    # Limits
    t_j_max: float = 150.0
    t_ambient: float = 40.0


@dataclass
class OperatingPoint:
    """Operating conditions for a three-phase inverter."""
    vdc: float              # DC link voltage (V)
    i_out_rms: float        # Output RMS current (A)
    f_out: float = 50.0     # Output frequency (Hz)
    f_sw: float = 4000.0    # Switching frequency (Hz)
    m: float = 1.0          # Modulation index
    cos_phi: float = 0.85   # Power factor
    modulation: str = "spwm"
    t_ambient: float = 40.0


def calculate_inverter_losses(
    config: InverterConfig,
    op: OperatingPoint,
    include_steps: bool = True,
) -> dict:
    """
    Calculate total losses for a three-phase two-level inverter.

    Returns comprehensive loss breakdown with thermal iteration.

    Six IGBTs + six diodes in three phase legs, plus optional brake chopper.
    """
    steps = []

    i_peak = op.i_out_rms * np.sqrt(2)
    rg_total = config.rg_int + config.rg_ext

    # Create energy lookup functions
    eon_func = create_energy_lookup(
        [type('Pt', (), {'current': p[0], 'energy': p[1]}) for p in config.eon_points]
    ) if config.eon_points else lambda ic: 0.0

    eoff_func = create_energy_lookup(
        [type('Pt', (), {'current': p[0], 'energy': p[1]}) for p in config.eoff_points]
    ) if config.eoff_points else lambda ic: 0.0

    err_func = create_energy_lookup(
        [type('Pt', (), {'current': p[0], 'energy': p[1]}) for p in config.err_points]
    ) if config.err_points else lambda ic: 0.0

    # ── Thermal iteration ──────────────────────────────────────────
    # Define 14 devices: 6 switches, 6 diodes, 1 brake switch, 1 brake diode
    sw_prefix = "SiC_MOS" if config.is_sic else "IGBT"
    sw_type = "SiC MOSFET" if config.is_sic else "IGBT"
    diode_prefix = "SiC_BD" if config.is_sic else "Diode"
    diode_type = "Body Diode" if config.is_sic else "Diode"

    device_names = []
    for phase in ["U", "V", "W"]:
        for pos in ["H", "L"]:
            device_names.append(f"{sw_prefix}_{pos}_{phase}")
    for phase in ["U", "V", "W"]:
        for pos in ["H", "L"]:
            device_names.append(f"{diode_prefix}_{pos}_{phase}")
    if config.has_brake:
        device_names.append(f"{sw_prefix}_Brake")
        device_names.append(f"{diode_prefix}_Brake")

    t_j_initial = op.t_ambient + 40.0  # Initial guess

    def loss_calculator(t_j_dict: dict) -> dict:
        """Compute loss for each device given Tj map."""
        losses = {}
        brake_sw = f"{sw_prefix}_Brake"
        brake_di = f"{diode_prefix}_Brake"
        for name in device_names:
            if name == brake_sw or name == brake_di:
                losses[name] = 0.0
            elif name.startswith(sw_prefix):
                losses[name] = 0.0  # placeholder, computed below
            elif name.startswith(diode_prefix):
                losses[name] = 0.0  # placeholder
        return losses

    # For convergence, I will directly compute with the final iteration approach:
    # Start with Tj guess, compute all losses, update Tj, iterate

    t_j_igbt = np.full(6, t_j_initial)
    t_j_diode = np.full(6, t_j_initial)
    t_j_brake_igbt = t_j_initial
    t_j_brake_diode = t_j_initial

    max_iter = 20
    tol = 0.1
    converged = False
    iter_log = []

    for iteration in range(max_iter):
        # ── Conduction loss per IGBT ──
        t_j_igbt_mean = np.mean(t_j_igbt)
        vce_sat = vce_sat_at_temp(config.vce_sat_25, config.vce_sat_125, t_j_igbt_mean)

        if config.is_sic:
            rds_on = rds_on_at_temp(config.rds_on_25, config.rds_on_125, t_j_igbt_mean)
            cond_igbt = sic_conduction_loss(i_peak, op.m, op.cos_phi, rds_on)
        else:
            cond_igbt = igbt_conduction_loss(i_peak, op.m, op.cos_phi, vce_sat)
        p_cond_igbt_total = cond_igbt["p_cond"]  # per half-bridge pair (high + low)

        # Per-switch IGBT conduction loss (split evenly between high and low)
        p_cond_igbt_h = cond_igbt["p_cond_high"]
        p_cond_igbt_l = cond_igbt["p_cond_low"]

        # ── Diode conduction loss ──
        t_j_diode_mean = np.mean(t_j_diode)
        if config.is_sic:
            vsd = vf_at_temp(config.vsd_25, config.vsd_125, t_j_diode_mean)
        else:
            vsd = vf_at_temp(config.vf_25, config.vf_125, t_j_diode_mean)
        cond_diode = diode_conduction_loss(i_peak, op.m, op.cos_phi, vsd)
        p_cond_diode_h = cond_diode["p_cond_high"]
        p_cond_diode_l = cond_diode["p_cond_low"]

        # ── Switching loss per leg ──
        sw = compute_switching_loss(
            i_peak=i_peak, f_sw=op.f_sw, f_out=op.f_out,
            m=op.m, cos_phi=op.cos_phi,
            eon_func=eon_func, eoff_func=eoff_func, err_func=err_func,
            vdc=op.vdc, vdc_ref=config.eon_vcc_ref,
            t_j=t_j_igbt_mean, t_ref=125.0,
            rg_actual=rg_total, rg_ref=config.eon_rg_ref,
        )
        p_sw_igbt_per_leg = sw["p_sw_igbt"]  # Per leg (high+low combined)
        p_sw_diode_per_leg = sw["p_sw_diode"]

        # Split switching loss: high and low each get half
        p_sw_igbt_h = p_sw_igbt_per_leg / 2
        p_sw_igbt_l = p_sw_igbt_per_leg / 2
        p_sw_diode_h = p_sw_diode_per_leg / 2
        p_sw_diode_l = p_sw_diode_per_leg / 2

        # ── Summary (per leg: high + low) ──
        p_igbt_cond_per_leg = p_cond_igbt_total
        p_igbt_sw_per_leg = p_sw_igbt_per_leg
        p_diode_cond_per_leg = cond_diode["p_cond"]
        p_diode_sw_per_leg = p_sw_diode_per_leg

        # ── Brake chopper (simplified: 1% duty) ──
        p_brake_igbt = 0.0
        p_brake_diode = 0.0
        if config.has_brake:
            brake_duty = 0.01
            brake_i = op.i_out_rms * np.sqrt(2) * 0.1  # Assume 10% of peak
            bvce = vce_sat_at_temp(config.brake_vce_sat_25, config.brake_vce_sat_125, t_j_brake_igbt)
            p_brake_igbt = bvce * brake_i * brake_duty
            bvf = vf_at_temp(config.brake_vf_25, config.brake_vf_125, t_j_brake_diode)
            p_brake_diode = bvf * brake_i * brake_duty

        # ── Compute new junction temperatures ──
        # Total module loss
        p_total_3ph = 3 * (p_igbt_cond_per_leg + p_igbt_sw_per_leg +
                          p_diode_cond_per_leg + p_diode_sw_per_leg)
        p_total_module = p_total_3ph + p_brake_igbt + p_brake_diode

        # Thermal network: Rth_ch is per-module (shared case temperature)
        t_heatsink = op.t_ambient + p_total_module * config.rth_ha
        t_case = t_heatsink + p_total_module * config.rth_ch  # Same case temp for all devices

        # Per-device losses (high-side switch = IGBT + diode in upper position)
        p_igbt_h = p_cond_igbt_h + p_sw_igbt_h
        p_igbt_l = p_cond_igbt_l + p_sw_igbt_l
        p_diode_h = p_cond_diode_h + p_sw_diode_h
        p_diode_l = p_cond_diode_l + p_sw_diode_l

        t_j_new_igbt_h = t_case + p_igbt_h * config.rth_jc_igbt
        t_j_new_igbt_l = t_case + p_igbt_l * config.rth_jc_igbt
        t_j_new_diode_h = t_case + p_diode_h * config.rth_jc_diode
        t_j_new_diode_l = t_case + p_diode_l * config.rth_jc_diode

        # Clamp Tj to physically reasonable range [Tamb, 250°C]
        t_j_new_igbt_h = max(op.t_ambient, min(250.0, t_j_new_igbt_h))
        t_j_new_igbt_l = max(op.t_ambient, min(250.0, t_j_new_igbt_l))
        t_j_new_diode_h = max(op.t_ambient, min(250.0, t_j_new_diode_h))
        t_j_new_diode_l = max(op.t_ambient, min(250.0, t_j_new_diode_l))

        # Update Tj arrays (6 IGBTs, 6 diodes)
        new_t_j_igbt = np.array([
            float(t_j_new_igbt_h), float(t_j_new_igbt_l),
            float(t_j_new_igbt_h), float(t_j_new_igbt_l),
            float(t_j_new_igbt_h), float(t_j_new_igbt_l),
        ])
        new_t_j_diode = np.array([
            float(t_j_new_diode_h), float(t_j_new_diode_l),
            float(t_j_new_diode_h), float(t_j_new_diode_l),
            float(t_j_new_diode_h), float(t_j_new_diode_l),
        ])

        # Check convergence
        max_change = max(
            float(np.max(np.abs(new_t_j_igbt - t_j_igbt))),
            float(np.max(np.abs(new_t_j_diode - t_j_diode))),
        )

        iter_log.append({
            "iteration": iteration + 1,
            "t_heatsink": round(float(t_heatsink), 2),
            "t_case": round(float(t_case), 2),
            "t_j_igbt_h": round(float(t_j_new_igbt_h), 2),
            "t_j_diode_h": round(float(t_j_new_diode_h), 2),
            "p_igbt_cond_per_leg": round(p_igbt_cond_per_leg, 2),
            "p_igbt_sw_per_leg": round(p_igbt_sw_per_leg, 2),
            "p_diode_cond_per_leg": round(p_diode_cond_per_leg, 2),
            "p_diode_sw_per_leg": round(p_diode_sw_per_leg, 2),
            "max_tj_change": round(max_change, 4),
        })

        t_j_igbt = new_t_j_igbt
        t_j_diode = new_t_j_diode

        if max_change < tol:
            converged = True
            break

    # ── Build result ──────────────────────────────────────────────────
    # Per-device detail
    devices = []
    phases = ["U", "V", "W"]
    for phase_idx, phase in enumerate(phases):
        for pos, p_cond, p_sw, t_j_val in [
            ("H", p_cond_igbt_h, p_sw_igbt_h, float(t_j_igbt[phase_idx * 2])),
            ("L", p_cond_igbt_l, p_sw_igbt_l, float(t_j_igbt[phase_idx * 2 + 1])),
        ]:
            devices.append({
                "name": f"{sw_prefix}_{pos}_{phase}",
                "p_cond": round(p_cond, 3),
                "p_sw": round(p_sw, 3),
                "p_total": round(p_cond + p_sw, 3),
                "t_j": round(t_j_val, 2),
                "type": sw_type,
            })
        for pos, p_cond, p_sw, t_j_val in [
            ("H", p_cond_diode_h, p_sw_diode_h, float(t_j_diode[phase_idx * 2])),
            ("L", p_cond_diode_l, p_sw_diode_l, float(t_j_diode[phase_idx * 2 + 1])),
        ]:
            devices.append({
                "name": f"{diode_prefix}_{pos}_{phase}",
                "p_cond": round(p_cond, 3),
                "p_sw": round(p_sw, 3),
                "p_total": round(p_cond + p_sw, 3),
                "t_j": round(t_j_val, 2),
                "type": diode_type,
            })

    if config.has_brake:
        devices.append({
            "name": f"{sw_prefix}_Brake",
            "p_cond": round(p_brake_igbt, 3),
            "p_sw": 0.0,
            "p_total": round(p_brake_igbt, 3),
            "t_j": round(float(t_j_brake_igbt), 2),
            "type": sw_type,
        })
        devices.append({
            "name": f"{diode_prefix}_Brake",
            "p_cond": round(p_brake_diode, 3),
            "p_sw": 0.0,
            "p_total": round(p_brake_diode, 3),
            "t_j": round(float(t_j_brake_diode), 2),
            "type": diode_type,
        })

    # Aggregates
    p_igbt_cond_total = 3 * p_igbt_cond_per_leg
    p_igbt_sw_total = 3 * p_igbt_sw_per_leg
    p_diode_cond_total = 3 * p_diode_cond_per_leg
    p_diode_sw_total = 3 * p_diode_sw_per_leg
    p_total = p_igbt_cond_total + p_igbt_sw_total + p_diode_cond_total + p_diode_sw_total

    if config.has_brake:
        p_total += p_brake_igbt + p_brake_diode

    # Output power
    v_out_rms = op.vdc * op.m / (2 * np.sqrt(2))  # Phase voltage RMS
    p_out = 3 * v_out_rms * op.i_out_rms * op.cos_phi
    efficiency = p_out / (p_out + p_total) if (p_out + p_total) > 0 else 0.0

    t_j_all = [d["t_j"] for d in devices]
    max_tj_idx = np.argmax(t_j_all)
    max_tj = max(t_j_all)

    result = {
        "p_total_loss": round(p_total, 2),
        "p_igbt_cond": round(p_igbt_cond_total, 2),
        "p_igbt_sw": round(p_igbt_sw_total, 2),
        "p_diode_cond": round(p_diode_cond_total, 2),
        "p_diode_sw": round(p_diode_sw_total, 2),
        "p_brake_loss": round(p_brake_igbt + p_brake_diode, 2),
        "efficiency": round(efficiency * 100, 2),
        "p_out": round(p_out, 2),
        "t_j_max": round(max_tj, 2),
        "t_j_max_device": devices[max_tj_idx]["name"] if devices else "",
        "t_case_est": round(float(t_case), 2),
        "t_heatsink_est": round(float(t_heatsink), 2),
        "devices": devices,
        "iteration_count": len(iter_log),
        "converged": converged,
        "calculation_steps": _build_steps(config, op, cond_igbt, cond_diode, sw,
                                          iter_log, p_total, efficiency, i_peak),
        # Per-leg detail for frontend
        "per_leg": {
            "p_igbt_cond": round(p_igbt_cond_per_leg, 3),
            "p_igbt_sw": round(p_igbt_sw_per_leg, 3),
            "p_diode_cond": round(p_diode_cond_per_leg, 3),
            "p_diode_sw": round(p_diode_sw_per_leg, 3),
            "i_igbt_avg": round(cond_igbt["i_avg_high"] + cond_igbt["i_avg_low"], 3),
            "i_igbt_rms": round(
                np.sqrt(cond_igbt["i_rms_high"]**2 + cond_igbt["i_rms_low"]**2), 3),
            "i_diode_avg": round(cond_diode["i_avg_high"] + cond_diode["i_avg_low"], 3),
            "i_diode_rms": round(
                np.sqrt(cond_diode["i_rms_high"]**2 + cond_diode["i_rms_low"]**2), 3),
        },
    }

    return result


def _build_steps(config, op, cond_igbt, cond_diode, sw, iter_log,
                 p_total, efficiency, i_peak) -> list[dict]:
    """Build human-readable calculation steps."""
    steps = []

    steps.append({
        "title": "输入参数",
        "type": "input",
        "data": {
            "直流母线电压 Vdc": f"{op.vdc} V",
            "输出电流 RMS": f"{op.i_out_rms} A",
            "输出电流峰值 I_peak": f"{i_peak:.2f} A",
            "输出频率 f_out": f"{op.f_out} Hz",
            "开关频率 f_sw": f"{op.f_sw/1000:.2f} kHz",
            "调制比 m": f"{op.m}",
            "功率因数 cosφ": f"{op.cos_phi}",
            "环境温度 Tamb": f"{op.t_ambient} °C",
        },
    })

    sw_dev_name = "SiC MOSFET" if config.is_sic else "IGBT"
    diode_dev_name = "体二极管" if config.is_sic else "二极管"
    cond_formula = "Pcond = Rds(on)(Tj) × Id² × D(θ)" if config.is_sic else "Pcond = Vce(sat)(Tj) × Ic × D(θ)"
    cond_param = f"Rds(on) @ Tj: {config.rds_on_25} ~ {config.rds_on_125} mΩ" if config.is_sic else f"Vce(sat) @ Tj: {config.vce_sat_25} ~ {config.vce_sat_125} V"
    vf_label = "Vsd @ Tj" if config.is_sic else "Vf @ Tj"
    vf_values = f"{config.vsd_25} ~ {config.vsd_125} V" if config.is_sic else f"{config.vf_25} ~ {config.vf_125} V"
    diode_formula = "Pcond = Vsd(Tj) × If × (1-D(θ))" if config.is_sic else "Pcond_Diode = Vf(Tj) × If × (1-D(θ))"

    steps.append({
        "title": f"{sw_dev_name}导通损耗计算",
        "type": "calculation",
        "formula": f"{cond_formula}, 数值积分",
        "data": {
            cond_param.split(":")[0].strip(): cond_param.split(":", 1)[1].strip() if ":" in cond_param else cond_param,
            f"{sw_dev_name} 导通损耗 (每相)": f"{cond_igbt['p_cond']:.3f} W",
            f"{sw_dev_name} 上管导通损耗": f"{cond_igbt['p_cond_high']:.3f} W",
            f"{sw_dev_name} 下管导通损耗": f"{cond_igbt['p_cond_low']:.3f} W",
            f"{sw_dev_name} 上管平均电流": f"{cond_igbt['i_avg_high']:.3f} A",
            f"{sw_dev_name} 上管RMS电流": f"{cond_igbt['i_rms_high']:.3f} A",
            f"{sw_dev_name} 上管等效占空比": f"{cond_igbt['duty_high']:.4f}",
        },
    })

    steps.append({
        "title": f"{diode_dev_name}导通损耗计算",
        "type": "calculation",
        "formula": f"{diode_formula}, 数值积分",
        "data": {
            f"{vf_label}": vf_values,
            f"{diode_dev_name}导通损耗 (每相)": f"{cond_diode['p_cond']:.3f} W",
            f"{diode_dev_name}上管导通损耗": f"{cond_diode['p_cond_high']:.3f} W",
            f"{diode_dev_name}下管导通损耗": f"{cond_diode['p_cond_low']:.3f} W",
        },
    })

    steps.append({
        "title": "开关损耗计算",
        "type": "calculation",
        "formula": "Psw = f_sw × (Eon + Eoff) × (I/Iref)^Ki × (Vdc/Vref)^Kv",
        "data": {
            "平均Eon (每次开关)": f"{sw['avg_eon_mj']:.4f} mJ",
            "平均Eoff (每次开关)": f"{sw['avg_eoff_mj']:.4f} mJ",
            "平均Err (每次开关)": f"{sw['avg_err_mj']:.4f} mJ",
            f"{sw_dev_name}开关损耗 (每相)": f"{sw['p_sw_igbt']:.3f} W",
            f"{diode_dev_name}反向恢复损耗 (每相)": f"{sw['p_sw_diode']:.3f} W",
        },
    })

    steps.append({
        "title": f"热迭代收敛过程 ({len(iter_log)} 次迭代)",
        "type": "thermal",
        "data": iter_log,
    })

    steps.append({
        "title": "总损耗汇总",
        "type": "summary",
        "data": {
            f"{sw_dev_name}总导通损耗": f"{3 * cond_igbt['p_cond']:.2f} W",
            f"{sw_dev_name}总开关损耗": f"{3 * sw['p_sw_igbt']:.2f} W",
            f"{diode_dev_name}总导通损耗": f"{3 * cond_diode['p_cond']:.2f} W",
            f"{diode_dev_name}总开关损耗": f"{3 * sw['p_sw_diode']:.2f} W",
            "总损耗": f"{p_total:.2f} W",
            "效率": f"{efficiency:.2f}%",
        },
    })

    return steps
