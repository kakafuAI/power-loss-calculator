#!/usr/bin/env python3
"""API endpoint integration tests.

Requires backend running on localhost:8000.
"""

import json
import urllib.request
import urllib.error
import sys

BASE = "http://localhost:8000/api"


def api_post(path, body):
    """POST JSON to API and return response."""
    data = json.dumps(body).encode() if isinstance(body, dict) else body
    req = urllib.request.Request(f"{BASE}{path}", data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def assert_status(path, body, expected_code=200):
    """Check API response status code."""
    data = json.dumps(body).encode() if isinstance(body, dict) else body
    req = urllib.request.Request(f"{BASE}{path}", data=data,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == expected_code:
                print(f"  OK   {path} → {resp.status}")
                return json.loads(resp.read())
            else:
                print(f"  FAIL {path} → expected {expected_code}, got {resp.status}")
                return None
    except urllib.error.HTTPError as e:
        print(f"  FAIL {path} → {e.code}: {e.read().decode()[:200]}")
        return None


def test_health():
    print("\n--- Health Check ---")
    with urllib.request.urlopen(f"{BASE}/health") as resp:
        data = json.loads(resp.read())
        assert data["status"] == "ok"
        print(f"  OK   Server version: {data['version']}")


def test_calculate():
    print("\n--- Calculate Endpoint ---")
    body = {
        "config": {
            "device_type": "igbt_module",
            "module_name": "API Test",
            "vdc_rated": 1200,
            "ic_rated": 100,
            "num_parallel_chips": 1,
            "t_j_max": 150,
            "rth_ch_module": 0.02,
            "rth_ha": 0.08,
            "igbt": {
                "vce_sat_25": 1.7, "vce_sat_125": 2.0, "ic_nom": 100, "vce_rated": 1200,
                "eon_curve": {"vcc": 600, "rg": 10, "tj": 125,
                    "points": [{"current": 10, "energy": 5}, {"current": 50, "energy": 25}, {"current": 100, "energy": 55}]},
                "eoff_curve": {"vcc": 600, "rg": 10, "tj": 125,
                    "points": [{"current": 10, "energy": 3}, {"current": 50, "energy": 15}, {"current": 100, "energy": 35}]},
                "thermal": {"rth_jc": 0.24}
            },
            "diode": {
                "vf_25": 1.8, "vf_125": 1.6, "if_nom": 100,
                "err_curve": {"vcc": 600, "rg": 10, "tj": 125,
                    "points": [{"current": 10, "energy": 2}, {"current": 50, "energy": 10}, {"current": 100, "energy": 22}]},
                "qrr": 5, "thermal": {"rth_jc": 0.42}
            }
        },
        "conditions": {
            "vdc": 600, "i_out_rms": 50, "f_out": 50, "f_sw": 4000,
            "modulation_index": 1.0, "power_factor": 0.85, "modulation": "spwm", "t_ambient": 40
        }
    }

    result = assert_status("/calculate", body)
    if result:
        checks = [
            ("p_total_loss", result["p_total_loss"] > 0),
            ("efficiency", 90 < result["efficiency"] < 100),
            ("12 devices", len(result["devices"]) == 12),
            ("converged", result["converged"]),
            ("has calculation_steps", len(result["calculation_steps"]) > 0),
            ("has per_leg", result.get("per_leg") is not None),
        ]
        for name, passed in checks:
            print(f"  {'OK' if passed else 'FAIL'}   {name}")


def test_curve():
    print("\n--- Curve Endpoint ---")
    body = {
        "config": {
            "device_type": "igbt_module", "module_name": "Curve Test",
            "vdc_rated": 1200, "ic_rated": 100, "num_parallel_chips": 1, "t_j_max": 150,
            "igbt": {
                "vce_sat_25": 1.7, "vce_sat_125": 2.0, "ic_nom": 100, "vce_rated": 1200,
                "eon_curve": {"vcc": 600, "rg": 10, "tj": 125,
                    "points": [{"current": 10, "energy": 5}, {"current": 50, "energy": 25}]},
                "eoff_curve": {"vcc": 600, "rg": 10, "tj": 125,
                    "points": [{"current": 10, "energy": 3}, {"current": 50, "energy": 15}]},
                "thermal": {"rth_jc": 0.24}
            },
            "diode": {
                "vf_25": 1.8, "vf_125": 1.6, "if_nom": 100,
                "err_curve": {"vcc": 600, "rg": 10, "tj": 125,
                    "points": [{"current": 10, "energy": 2}, {"current": 50, "energy": 10}]},
                "qrr": 5, "thermal": {"rth_jc": 0.42}
            }
        },
        "conditions": {"vdc": 600, "i_out_rms": 50, "f_out": 50, "f_sw": 4000,
                       "modulation_index": 1.0, "power_factor": 0.85, "modulation": "spwm", "t_ambient": 40},
        "sweep_param": "i_out", "sweep_start": 1.0, "sweep_end": 100.0, "sweep_points": 10
    }

    result = assert_status("/calculate/curve", body)
    if result:
        assert len(result["curves"]) > 0, "Has curves"
        for curve in result["curves"]:
            assert len(curve["points"]) == 10, f"10 points in {curve['name']}"
        print(f"  OK   {len(result['curves'])} curves generated")


def test_export():
    print("\n--- Export Endpoints ---")
    # Get a real result first
    body = {
        "config": {
            "device_type": "igbt_module", "module_name": "Export Test",
            "vdc_rated": 1200, "ic_rated": 100, "num_parallel_chips": 1, "t_j_max": 150,
            "igbt": {
                "vce_sat_25": 1.7, "vce_sat_125": 2.0, "ic_nom": 100, "vce_rated": 1200,
                "eon_curve": {"vcc": 600, "rg": 10, "tj": 125, "points": [{"current": 10, "energy": 5}, {"current": 50, "energy": 25}]},
                "eoff_curve": {"vcc": 600, "rg": 10, "tj": 125, "points": [{"current": 10, "energy": 3}, {"current": 50, "energy": 15}]},
                "thermal": {"rth_jc": 0.24}
            },
            "diode": {
                "vf_25": 1.8, "vf_125": 1.6, "if_nom": 100,
                "err_curve": {"vcc": 600, "rg": 10, "tj": 125, "points": [{"current": 10, "energy": 2}, {"current": 50, "energy": 10}]},
                "qrr": 5, "thermal": {"rth_jc": 0.42}
            }
        },
        "conditions": {"vdc": 600, "i_out_rms": 50, "f_out": 50, "f_sw": 4000,
                       "modulation_index": 1.0, "power_factor": 0.85, "modulation": "spwm", "t_ambient": 40}
    }

    calc_result = assert_status("/calculate", body)
    if not calc_result:
        print("  SKIP Cannot get calculation result for export test")
        return

    # Test Excel export
    data = json.dumps(calc_result).encode()
    req = urllib.request.Request(f"{BASE}/export/excel", data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        content = resp.read()
        assert len(content) > 1000, "Excel file non-trivial size"
        assert resp.headers.get("Content-Disposition", "").endswith(".xlsx"), "Excel filename"
        print(f"  OK   Excel export: {len(content)} bytes")

    # Test CSV export
    req = urllib.request.Request(f"{BASE}/export/csv", data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        content = resp.read()
        assert len(content) > 100, "CSV file non-trivial size"
        print(f"  OK   CSV export: {len(content)} bytes")


if __name__ == "__main__":
    print("=" * 50)
    print("Power Loss Calculator - API Tests")
    print("=" * 50)

    try:
        test_health()
        test_calculate()
        test_curve()
        test_export()
        print("\n" + "=" * 50)
        print("All API tests completed.")
    except urllib.error.URLError as e:
        print(f"\nERROR: Cannot connect to backend at {BASE}")
        print("Make sure the server is running: cd backend && uvicorn app.main:app")
        sys.exit(1)
