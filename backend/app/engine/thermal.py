"""Thermal model and junction temperature iteration."""

import numpy as np
from dataclasses import dataclass, field


@dataclass
class ThermalState:
    """Thermal state for one semiconductor device."""
    name: str
    rth_jc: float           # K/W junction-to-case
    rth_ch: float = 0.0     # K/W case-to-heatsink (module-level, shared)
    p_loss: float = 0.0     # Total loss (W)
    t_j: float = 40.0       # Junction temp (°C)
    t_case: float = 40.0    # Case temp (°C)
    t_heatsink: float = 40.0  # Heatsink temp (°C)


@dataclass
class ThermalSystem:
    """System-level thermal network."""
    devices: list[ThermalState] = field(default_factory=list)
    rth_ha: float = 0.5       # Heatsink-to-ambient (K/W)
    t_ambient: float = 40.0   # Ambient temperature (°C)
    rth_ch_shared: float = 0.05  # Case-to-heatsink per module (K/W)


def calculate_temperatures(system: ThermalSystem) -> None:
    """
    Calculate all temperatures given current loss distribution.
    T_heatsink = T_ambient + P_total * Rth_ha
    T_case = T_heatsink + P_module * Rth_ch (per device: T_case = T_heatsink + P_device * Rth_ch)
    T_j = T_case + P_device * Rth_jc
    """
    p_total = sum(d.p_loss for d in system.devices)
    t_heatsink = system.t_ambient + p_total * system.rth_ha

    for dev in system.devices:
        dev.t_heatsink = t_heatsink
        dev.t_case = t_heatsink + dev.p_loss * system.rth_ch_shared
        dev.t_j = dev.t_case + dev.p_loss * dev.rth_jc


def thermal_iteration(
    system: ThermalSystem,
    loss_calculator,
    tol: float = 0.1,
    max_iter: int = 20,
) -> tuple[list[dict], int, bool]:
    """
    Iteratively solve for junction temperatures and losses.

    Args:
        system: Thermal system definition with initial Tj guesses
        loss_calculator: callable(t_j_dict) -> dict mapping device_name -> p_loss
        tol: convergence tolerance in °C
        max_iter: maximum iterations

    Returns:
        (iteration_log, n_iter, converged)
    """
    log = []
    t_j_prev = {d.name: d.t_j for d in system.devices}

    for iteration in range(max_iter):
        # Calculate temperatures based on current loss estimates
        calculate_temperatures(system)

        # Get new losses based on updated Tj
        t_j_current = {d.name: d.t_j for d in system.devices}
        new_losses = loss_calculator(t_j_current)

        # Update device losses
        for dev in system.devices:
            dev.p_loss = new_losses.get(dev.name, dev.p_loss)

        # Recalculate temperatures with new losses
        calculate_temperatures(system)

        # Check convergence
        max_change = max(
            abs(system.devices[i].t_j - t_j_prev.get(d.name, 0.0))
            for i, d in enumerate(system.devices)
        )

        step_info = {
            "iteration": iteration + 1,
            "t_heatsink": round(system.devices[0].t_heatsink, 2) if system.devices else 0,
            "max_tj_change": round(max_change, 4),
            "devices": [
                {
                    "name": d.name,
                    "t_j": round(d.t_j, 2),
                    "p_loss": round(d.p_loss, 2),
                }
                for d in system.devices
            ],
        }
        log.append(step_info)

        if max_change < tol:
            return log, iteration + 1, True

        t_j_prev = {d.name: d.t_j for d in system.devices}

    return log, max_iter, False


def compute_case_temp(
    p_total_module: float,
    rth_ch: float,
    rth_ha: float,
    t_ambient: float,
    n_modules: int = 1,
) -> dict:
    """
    Compute case and heatsink temperatures for a module.

    Returns:
        dict with t_heatsink, t_case per module
    """
    p_system = p_total_module * n_modules
    t_heatsink = t_ambient + p_system * rth_ha
    t_case_per_module = t_heatsink + p_total_module * rth_ch

    return {
        "t_ambient": t_ambient,
        "t_heatsink": round(t_heatsink, 2),
        "t_case": round(t_case_per_module, 2),
        "p_total_system": round(p_system, 2),
        "delta_t_ha": round(p_system * rth_ha, 2),
        "delta_t_ch": round(p_total_module * rth_ch, 2),
    }
