"""Switching loss calculations for IGBT, SiC MOSFET, and diodes."""

import numpy as np
from scipy.interpolate import interp1d


def fit_energy_vs_current(points: list[tuple[float, float]]) -> interp1d:
    """
    Create interpolation function for E(Ic) from datasheet points.
    Falls back to power-law extrapolation outside the given range.

    Args:
        points: list of (current_A, energy_mJ) tuples
    """
    if len(points) < 2:
        return lambda ic: points[0][1] if points else 0.0

    x = np.array([p[0] for p in points])
    y = np.array([p[1] for p in points])
    # Use linear interpolation in log-log space for better extrapolation
    log_x = np.log(x)
    log_y = np.log(y)
    slope, intercept = np.polyfit(log_x, log_y, 1)

    def energy_func(ic: float) -> float:
        if ic <= 0:
            return 0.0
        # Interpolate in log-log and convert back
        return float(np.exp(intercept + slope * np.log(ic)))

    return energy_func


def scale_switching_energy(
    e_ref: float,
    i_actual: float,
    i_ref: float,
    v_actual: float,
    v_ref: float,
    rg_actual: float | None = None,
    rg_ref: float | None = None,
    t_actual: float | None = None,
    t_ref: float | None = None,
    k_i: float = 1.0,
    k_v: float = 1.0,
    k_rg: float = 0.0,
    k_t: float = 0.003,
) -> float:
    """
    Scale switching energy from reference conditions to actual conditions.

    Standard scaling formula:
      E = E_ref * (I/I_ref)^k_i * (V/V_ref)^k_v * (Rg/Rg_ref)^k_rg * (1 + k_t*(T - T_ref))

    Default coefficients are typical for IGBT modules.
    """
    e = e_ref
    if i_ref > 0:
        e *= (i_actual / i_ref) ** k_i
    e *= (v_actual / v_ref) ** k_v
    if rg_actual is not None and rg_ref is not None and rg_ref > 0:
        e *= (rg_actual / rg_ref) ** k_rg
    if t_actual is not None and t_ref is not None:
        e *= 1.0 + k_t * (t_actual - t_ref)
    return e


def compute_switching_loss(
    i_peak: float,
    f_sw: float,
    f_out: float,
    m: float,
    cos_phi: float,
    eon_func,
    eoff_func,
    err_func,
    vdc: float,
    vdc_ref: float,
    t_j: float,
    t_ref: float = 125.0,
    rg_actual: float | None = None,
    rg_ref: float | None = None,
    k_v_on: float = 1.0,
    k_v_off: float = 1.0,
    k_v_rr: float = 1.0,
    n_points: int = 200,
) -> dict:
    """
    Compute average switching loss for one complete half-bridge leg.

    A leg has 2 IGBTs (high-side + low-side) and 2 diodes, each switching at f_sw.
    The returned p_sw_igbt and p_sw_diode are per-leg totals.

    Reference: each IGBT switches at f_sw. Turn-on and turn-off energies
    depend on the instantaneous load current at the switching instant.
    Eon(Ic) and Eoff(Ic) come from the lookup functions, then are scaled
    by Vdc/Vdc_ref and Tj.
    """
    theta = np.linspace(0, 2 * np.pi, n_points)
    i = i_peak * np.sin(theta)

    eon_sum = 0.0
    eoff_sum = 0.0
    err_sum = 0.0

    for k in range(n_points):
        ic = abs(i[k])
        if ic <= 0:
            continue

        # Energy at this current magnitude (same for HS and LS IGBT)
        eon = eon_func(ic)
        eoff = eoff_func(ic)
        err = err_func(ic) if err_func is not None else 0.0

        # Scale for Vdc and Tj (current dependence is already in the lookup)
        eon = scale_switching_energy(eon, 1.0, 1.0, vdc, vdc_ref,
                                     rg_actual, rg_ref, t_j, t_ref,
                                     0.0, k_v_on)
        eoff = scale_switching_energy(eoff, 1.0, 1.0, vdc, vdc_ref,
                                      rg_actual, rg_ref, t_j, t_ref,
                                      0.0, k_v_off)
        err = scale_switching_energy(err, 1.0, 1.0, vdc, vdc_ref,
                                     rg_actual, rg_ref, t_j, t_ref,
                                     0.0, k_v_rr)

        # Each sample represents a switching event for ONE IGBT/diode
        # Summing over the full cycle captures both HS and LS devices
        eon_sum += eon
        eoff_sum += eoff
        err_sum += err

    # Average energy per IGBT switching event (Eon + Eoff)
    avg_eon = eon_sum / n_points if n_points > 0 else 0.0
    avg_eoff = eoff_sum / n_points if n_points > 0 else 0.0
    avg_err = err_sum / n_points if n_points > 0 else 0.0

    # Per IGBT: P_sw = f_sw * (avg_eon + avg_eoff) / 1000  (mJ → J)
    # Per leg = 2 IGBTs + 2 diodes
    #   IGBT loss per leg  = 2 * f_sw * (avg_eon + avg_eoff) / 1000
    #   Diode loss per leg = 2 * f_sw * avg_err / 1000
    n_dev_per_leg = 2  # HS + LS
    p_sw_igbt = n_dev_per_leg * f_sw * (avg_eon + avg_eoff) / 1000.0
    p_sw_diode = n_dev_per_leg * f_sw * avg_err / 1000.0

    return {
        "p_sw_igbt": float(p_sw_igbt),
        "p_sw_diode": float(p_sw_diode),
        "avg_eon_mj": float(avg_eon),
        "avg_eoff_mj": float(avg_eoff),
        "avg_err_mj": float(avg_err),
        "eon_sum_mj": float(eon_sum),
        "eoff_sum_mj": float(eoff_sum),
        "err_sum_mj": float(err_sum),
    }


def create_energy_lookup(points: list, min_current: float = 0.0) -> callable:
    """
    Create a piecewise-linear energy lookup from datasheet points.
    Returns a callable f(current) -> energy in mJ.

    Single-point: assumes E ∝ I (linear through origin).
    Multi-point: piecewise linear interpolation between given points.
    Extrapolates with power law beyond the highest current point.
    """
    if not points:
        return lambda ic: 0.0

    currents = np.array([p.current for p in points])
    energies = np.array([p.energy for p in points])

    # Sort by current
    idx = np.argsort(currents)
    currents = currents[idx]
    energies = energies[idx]

    # Force (0,0) into the interpolation so single-point data still scales with current
    if currents[0] > 0:
        currents = np.insert(currents, 0, 0.0)
        energies = np.insert(energies, 0, 0.0)

    def lookup(ic: float) -> float:
        if ic <= min_current:
            return 0.0
        if ic <= currents[-1]:
            return float(np.interp(ic, currents, energies))
        # Extrapolate: E ∝ I^k where k is fitted from last two points
        if len(currents) >= 3:  # (0,0) + at least 2 real points
            nonzero = currents > 0
            cx = currents[nonzero]
            ce = energies[nonzero]
            if len(cx) >= 2:
                k = np.log(ce[-1] / ce[-2]) / np.log(cx[-1] / cx[-2])
                return float(energies[-1] * (ic / currents[-1]) ** k)
        return float(energies[-1] * (ic / currents[-1]))

    return lookup
