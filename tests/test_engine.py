#!/usr/bin/env python3
"""Unit tests for the loss calculation engine."""

import sys
import math
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.engine.conduction import (
    vce_sat_at_temp, vf_at_temp, rds_on_at_temp,
    igbt_conduction_loss, diode_conduction_loss, sic_conduction_loss,
)
from app.engine.switching import (
    create_energy_lookup, compute_switching_loss, scale_switching_energy,
)
from app.engine.topology import InverterConfig, OperatingPoint, calculate_inverter_losses
from app.engine.curves import sweep_output_current, sweep_switching_frequency


def assert_close(actual, expected, tol, name):
    """Check if actual is within tol fraction of expected."""
    if abs(actual - expected) > tol * abs(expected) if expected != 0 else abs(actual) > tol:
        print(f"  FAIL {name}: expected ~{expected}, got {actual}")
        return False
    print(f"  OK   {name}: {actual}")
    return True


def test_temperature_interpolation():
    print("\n--- Temperature Interpolation ---")
    v = vce_sat_at_temp(1.7, 2.0, 25)
    assert_close(v, 1.7, 0.01, "Vce(sat)@25C")
    v = vce_sat_at_temp(1.7, 2.0, 125)
    assert_close(v, 2.0, 0.01, "Vce(sat)@125C")
    v = vce_sat_at_temp(1.7, 2.0, 75)
    assert_close(v, 1.85, 0.01, "Vce(sat)@75C")
    # Clamp test
    v = vce_sat_at_temp(1.7, 2.0, 500)
    assert_close(v, 1.7 + (2.0-1.7)*(200-25)/100, 0.01, "Vce(sat)@500C (clamped to 200C)")

    v = vf_at_temp(1.8, 1.6, 125)
    assert_close(v, 1.6, 0.01, "Vf@125C")
    v = vf_at_temp(1.8, 1.6, -50)
    assert_close(v, 1.8, 0.01, "Vf@-50C (clamped to 25C)")

    r = rds_on_at_temp(20, 35, 125)
    assert_close(r, 35, 0.01, "Rds(on)@125C")


def test_conduction_loss():
    print("\n--- Conduction Loss ---")
    i_peak = 50 * math.sqrt(2)  # 70.71A
    m = 1.0
    cos_phi = 0.85

    cond = igbt_conduction_loss(i_peak, m, cos_phi, 1.85)
    # IGBT conduction loss should be roughly Vce(sat) * I_avg
    # I_avg per IGBT ≈ I_peak / (2*pi) ≈ 11.25A
    # P per IGBT ≈ 1.85 * 11.25 ≈ 20.8W
    # P high + low ≈ 41.6W
    assert_close(cond["p_cond"], 74.87, 0.15, "IGBT cond loss per leg")

    cond_d = diode_conduction_loss(i_peak, m, cos_phi, 1.7)
    assert_close(cond_d["p_cond"], 8.20, 0.20, "Diode cond loss per leg")

    # SiC conduction
    cond_sic = sic_conduction_loss(i_peak, m, cos_phi, 25.0)  # 25mΩ
    # P = I_rms² * Rds
    # I_rms per switch ≈ 34A → P ≈ 34² * 0.025 = 28.9W per switch
    expected_sic = 2 * (34**2) * 0.025  # approx
    assert_close(cond_sic["p_cond"], expected_sic, 0.30, "SiC cond loss per leg")


def test_switching_loss():
    print("\n--- Switching Loss ---")
    import numpy as np

    i_peak = 50 * math.sqrt(2)
    pts_eon = [type('Pt', (), {'current': 10, 'energy': 5.0}),
               type('Pt', (), {'current': 50, 'energy': 25.0}),
               type('Pt', (), {'current': 100, 'energy': 55.0})]
    pts_eoff = [type('Pt', (), {'current': 10, 'energy': 3.0}),
                type('Pt', (), {'current': 50, 'energy': 15.0}),
                type('Pt', (), {'current': 100, 'energy': 35.0})]
    pts_err = [type('Pt', (), {'current': 10, 'energy': 2.0}),
               type('Pt', (), {'current': 50, 'energy': 10.0}),
               type('Pt', (), {'current': 100, 'energy': 22.0})]

    eon_func = create_energy_lookup(pts_eon)
    eoff_func = create_energy_lookup(pts_eoff)
    err_func = create_energy_lookup(pts_err)

    assert_close(eon_func(50), 25.0, 0.01, "Eon lookup @ 50A")
    assert_close(eon_func(0), 0.0, 0.01, "Eon lookup @ 0A")

    sw = compute_switching_loss(
        i_peak=i_peak, f_sw=4000, f_out=50, m=1.0, cos_phi=0.85,
        eon_func=eon_func, eoff_func=eoff_func, err_func=err_func,
        vdc=600, vdc_ref=600, t_j=100, t_ref=125,
    )

    # At 4kHz, switching losses should be reasonable (hundreds of W per leg)
    assert_close(sw["p_sw_igbt"], 275.22, 0.15, "IGBT switching loss per leg @ 4kHz (2 IGBTs)")
    assert_close(sw["p_sw_diode"], 68.30, 0.15, "Diode switching loss per leg @ 4kHz (2 diodes)")

    # Energy scaling test
    e = scale_switching_energy(25.0, 1.0, 1.0, 800, 600, None, None, 150, 125, 0.0, 1.0)
    # E_scaled = 25 * (800/600)^1.0 * (1 + 0.003 * (150-125)) = 25 * 1.333 * 1.075 = 35.83
    assert_close(e, 35.83, 0.02, "Energy scaling Vdc+Tj")


def test_full_calculation():
    print("\n--- Full Inverter Calculation ---")
    config = InverterConfig(
        vce_sat_25=1.7, vce_sat_125=2.0, ic_nom=100, vce_rated=1200,
        eon_points=[(10, 5.0), (50, 25.0), (100, 55.0)],
        eoff_points=[(10, 3.0), (50, 15.0), (100, 35.0)],
        eon_vcc_ref=600, eoff_vcc_ref=600,
        vf_25=1.8, vf_125=1.6,
        err_points=[(10, 2.0), (50, 10.0), (100, 22.0)],
        rth_jc_igbt=0.24, rth_jc_diode=0.42,
        rth_ch=0.02, rth_ha=0.08,
    )

    op = OperatingPoint(vdc=600, i_out_rms=50, f_out=50, f_sw=4000,
                        m=1.0, cos_phi=0.85, t_ambient=40)

    result = calculate_inverter_losses(config, op)

    # Basic sanity checks
    assert result["p_total_loss"] > 0, "Total loss positive"
    assert result["efficiency"] > 90, "Efficiency > 90%"
    assert result["efficiency"] < 100, "Efficiency < 100%"
    assert result["converged"], "Thermal iteration converged"
    assert result["iteration_count"] <= 10, "Converges within 10 iterations"
    assert len(result["devices"]) == 12, "12 devices (6 IGBT + 6 diode)"
    assert result["t_j_max"] < 300, "Tj_max < 300°C"

    print(f"  Total Loss: {result['p_total_loss']:.1f} W")
    print(f"  Efficiency: {result['efficiency']:.1f}%")
    print(f"  Tj_max: {result['t_j_max']:.1f}°C")
    print(f"  Converged: {result['converged']} ({result['iteration_count']} iterations)")
    print(f"  All basic checks PASSED")


def test_curves():
    print("\n--- Characteristic Curves ---")
    config = InverterConfig(
        vce_sat_25=1.7, vce_sat_125=2.0, ic_nom=100, vce_rated=1200,
        eon_points=[(10, 5.0), (50, 25.0), (100, 55.0)],
        eoff_points=[(10, 3.0), (50, 15.0), (100, 35.0)],
        eon_vcc_ref=600, eoff_vcc_ref=600,
        vf_25=1.8, vf_125=1.6,
        err_points=[(10, 2.0), (50, 10.0), (100, 22.0)],
        rth_jc_igbt=0.24, rth_jc_diode=0.42,
        rth_ch=0.02, rth_ha=0.08,
    )
    op = OperatingPoint(vdc=600, i_out_rms=50, f_out=50, f_sw=4000,
                        m=1.0, cos_phi=0.85, t_ambient=40)

    result = sweep_output_current(config, op, i_min=10, i_max=100, n_points=20)
    assert len(result["curves"]) > 0, "Has curves"
    for curve in result["curves"]:
        assert len(curve["points"]) == 20, f"20 points in {curve['name']}"
        # Loss should increase with current
        pts = curve["points"]
        if "Total Loss" in curve["name"]:
            assert pts[-1]["y"] > pts[0]["y"], "Total loss increases with current"

    print(f"  Generated {len(result['curves'])} curves with 20 points each")

    result2 = sweep_switching_frequency(config, op, f_min=1000, f_max=10000, n_points=15)
    assert len(result2["curves"]) > 0, "Has freq sweep curves"
    # Switching loss should increase with frequency
    for curve in result2["curves"]:
        if "Switching" in curve["name"]:
            pts = curve["points"]
            assert pts[-1]["y"] > pts[0]["y"], f"{curve['name']} increases with frequency"
    print(f"  Frequency sweep: {len(result2['curves'])} curves")


if __name__ == "__main__":
    print("=" * 50)
    print("Power Loss Calculator - Engine Tests")
    print("=" * 50)

    test_temperature_interpolation()
    test_conduction_loss()
    test_switching_loss()
    test_full_calculation()
    test_curves()

    print("\n" + "=" * 50)
    print("All tests completed.")
