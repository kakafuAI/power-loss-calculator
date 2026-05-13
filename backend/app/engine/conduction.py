"""Conduction loss calculations for IGBT, SiC MOSFET, and diodes."""

import numpy as np


def vce_sat_at_temp(vce_25: float, vce_125: float, t_j: float) -> float:
    """Linearly interpolate Vce(sat) to Tj. Clamped to [25, 200]°C range."""
    t_clamped = max(25.0, min(200.0, t_j))
    return vce_25 + (vce_125 - vce_25) * (t_clamped - 25.0) / 100.0


def rds_on_at_temp(rds_25: float, rds_125: float, t_j: float) -> float:
    """Linearly interpolate Rds(on) (mΩ) to Tj. Clamped to [25, 200]°C range."""
    t_clamped = max(25.0, min(200.0, t_j))
    return rds_25 + (rds_125 - rds_25) * (t_clamped - 25.0) / 100.0


def vf_at_temp(vf_25: float, vf_125: float, t_j: float) -> float:
    """Linearly interpolate diode Vf to Tj. Clamped to [25, 200]°C range."""
    t_clamped = max(25.0, min(200.0, t_j))
    return vf_25 + (vf_125 - vf_25) * (t_clamped - 25.0) / 100.0


def igbt_conduction_loss(
    i_peak: float, m: float, cos_phi: float, vce_sat: float,
    n_points: int = 1000,
) -> dict:
    """
    IGBT conduction loss for one switch in a half-bridge leg.
    Uses numerical integration over one fundamental period.

    Returns per-unit results; multiply by actual Vce(sat)(Tj) for actual loss.
    """
    theta = np.linspace(0, 2 * np.pi, n_points)
    i = i_peak * np.sin(theta)
    # High-side IGBT duty cycle: D = 1/2 * (1 + m * sin(theta))
    # IGBT conducts when i > 0 (high-side) OR i < 0 (low-side) with their duty cycles
    # For high-side: D_h = 0.5 * (1 + m*sin(theta)), conducts when i > 0
    # For low-side:  D_l = 0.5 * (1 - m*sin(theta)), conducts when i < 0

    d_high = 0.5 * (1.0 + m * np.sin(theta))
    d_low = 0.5 * (1.0 - m * np.sin(theta))

    # High-side IGBT: conducts when i > 0
    mask_hs = i > 0
    p_inst_hs = np.where(mask_hs, vce_sat * i * d_high, 0.0)
    i_avg_hs = np.mean(np.where(mask_hs, i * d_high, 0.0))
    i_rms_hs = np.sqrt(np.mean(np.where(mask_hs, (i**2) * d_high, 0.0)))

    # Low-side IGBT: conducts when i < 0
    mask_ls = i < 0
    p_inst_ls = np.where(mask_ls, vce_sat * (-i) * d_low, 0.0)
    i_avg_ls = np.mean(np.where(mask_ls, (-i) * d_low, 0.0))
    i_rms_ls = np.sqrt(np.mean(np.where(mask_ls, ((-i)**2) * d_low, 0.0)))

    p_cond = float(np.mean(p_inst_hs + p_inst_ls))

    return {
        "p_cond": p_cond,
        "p_cond_high": float(np.mean(p_inst_hs)),
        "p_cond_low": float(np.mean(p_inst_ls)),
        "i_avg_high": float(i_avg_hs),
        "i_rms_high": float(i_rms_hs),
        "i_avg_low": float(i_avg_ls),
        "i_rms_low": float(i_rms_ls),
        "duty_high": float(np.mean(d_high[mask_hs])) if np.any(mask_hs) else 0.0,
        "duty_low": float(np.mean(d_low[mask_ls])) if np.any(mask_ls) else 0.0,
    }


def diode_conduction_loss(
    i_peak: float, m: float, cos_phi: float, vf: float,
    n_points: int = 1000,
) -> dict:
    """
    Diode conduction loss for one FWD in a half-bridge leg.
    """
    theta = np.linspace(0, 2 * np.pi, n_points)
    i = i_peak * np.sin(theta)

    d_high = 0.5 * (1.0 + m * np.sin(theta))
    d_low = 0.5 * (1.0 - m * np.sin(theta))

    # High-side diode: conducts when high-side switch is OFF (1-D_h) AND i < 0
    # Wait, let me re-derive:
    # High-side diode conducts when high-side IGBT is OFF and current is positive
    # Actually in a half-bridge:
    # - When high-side IGBT ON and i > 0: IGBT conducts
    # - When high-side IGBT ON and i < 0: diode conducts (freewheeling of low-side)
    # Wait no. In standard half-bridge leg:
    # - High-side IGBT ON, i > 0: high-side IGBT conducts (current from DC+ to load)
    # - High-side IGBT ON, i < 0: high-side diode conducts (load current returns to DC+)
    # - Low-side IGBT ON, i < 0: low-side IGBT conducts (current from load to DC-)
    # - Low-side IGBT ON, i > 0: low-side diode conducts (DC- to load via diode)

    # So high-side diode conducts when (D_high == 1, i.e. IGBT on) AND i < 0
    # Wait, instead of thinking about gating, let me use the common formula:
    # Diode conducts complementary to IGBT in the same leg position.
    # High-side diode: same leg as high-side IGBT, conducts opposite current

    # More precisely, the duty cycle for the high-side diode:
    # When output current > 0 and high-side IGBT off → low-side diode conducts
    # When output current < 0 and high-side IGBT on → high-side diode conducts

    # High-side diode conducts: D_h when i < 0
    mask_hs_diode = i < 0
    p_inst_hs_d = np.where(mask_hs_diode, vf * (-i) * d_high, 0.0)
    i_avg_hs_d = np.mean(np.where(mask_hs_diode, (-i) * d_high, 0.0))
    i_rms_hs_d = np.sqrt(np.mean(np.where(mask_hs_diode, ((-i)**2) * d_high, 0.0)))

    # Low-side diode conducts: D_l when i > 0
    mask_ls_diode = i > 0
    p_inst_ls_d = np.where(mask_ls_diode, vf * i * d_low, 0.0)
    i_avg_ls_d = np.mean(np.where(mask_ls_diode, i * d_low, 0.0))
    i_rms_ls_d = np.sqrt(np.mean(np.where(mask_ls_diode, (i**2) * d_low, 0.0)))

    p_cond = float(np.mean(p_inst_hs_d + p_inst_ls_d))

    return {
        "p_cond": p_cond,
        "p_cond_high": float(np.mean(p_inst_hs_d)),
        "p_cond_low": float(np.mean(p_inst_ls_d)),
        "i_avg_high": float(i_avg_hs_d),
        "i_rms_high": float(i_rms_hs_d),
        "i_avg_low": float(i_avg_ls_d),
        "i_rms_low": float(i_rms_ls_d),
        "duty_high": float(np.mean(d_high[mask_hs_diode])) if np.any(mask_hs_diode) else 0.0,
        "duty_low": float(np.mean(d_low[mask_ls_diode])) if np.any(mask_ls_diode) else 0.0,
    }


def sic_conduction_loss(
    i_peak: float, m: float, cos_phi: float, rds_on: float,
    n_points: int = 1000,
) -> dict:
    """
    SiC MOSFET conduction loss (Rds(on) * I²).
    Same conduction pattern as IGBT.
    """
    theta = np.linspace(0, 2 * np.pi, n_points)
    i = i_peak * np.sin(theta)

    d_high = 0.5 * (1.0 + m * np.sin(theta))
    d_low = 0.5 * (1.0 - m * np.sin(theta))

    # High-side SiC MOSFET: conducts when i > 0
    mask_hs = i > 0
    # Rds is in mΩ, so convert to Ω: rds_on / 1000
    rds = rds_on / 1000.0
    p_inst_hs = np.where(mask_hs, rds * (i**2) * d_high, 0.0)
    i_avg_hs = np.mean(np.where(mask_hs, i * d_high, 0.0))
    i_rms_hs = np.sqrt(np.mean(np.where(mask_hs, (i**2) * d_high, 0.0)))

    # Low-side: conducts when i < 0
    mask_ls = i < 0
    p_inst_ls = np.where(mask_ls, rds * ((-i)**2) * d_low, 0.0)
    i_avg_ls = np.mean(np.where(mask_ls, (-i) * d_low, 0.0))
    i_rms_ls = np.sqrt(np.mean(np.where(mask_ls, ((-i)**2) * d_low, 0.0)))

    p_cond = float(np.mean(p_inst_hs + p_inst_ls))

    return {
        "p_cond": p_cond,
        "p_cond_high": float(np.mean(p_inst_hs)),
        "p_cond_low": float(np.mean(p_inst_ls)),
        "i_avg_high": float(i_avg_hs),
        "i_rms_high": float(i_rms_hs),
        "i_avg_low": float(i_avg_ls),
        "i_rms_low": float(i_rms_ls),
        "duty_high": float(np.mean(d_high[mask_hs])) if np.any(mask_hs) else 0.0,
        "duty_low": float(np.mean(d_low[mask_ls])) if np.any(mask_ls) else 0.0,
    }
