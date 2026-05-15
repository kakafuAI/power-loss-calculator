"""Input / output models for loss calculation."""

from typing import Optional
from pydantic import BaseModel, Field

from .device import DeviceType, Modulation, ModuleConfigCompact


# ── Operating Conditions ──────────────────────────────────────────────

class OperatingConditions(BaseModel):
    """User-input operating conditions."""
    vdc: float = Field(..., gt=0, description="DC bus voltage (V)")
    i_out_rms: float = Field(..., gt=0, description="Output RMS current (A)")
    i_out_peak: Optional[float] = Field(None, description="Output peak current, defaults to sqrt(2)*I_rms")
    f_out: float = Field(50.0, gt=0, description="Output frequency (Hz)")
    f_sw: float = Field(..., gt=0, description="Switching frequency (Hz)")
    modulation_index: float = Field(1.0, ge=0, le=1.15, description="Modulation index m")
    power_factor: float = Field(0.85, ge=-1, le=1, description="Load power factor cos(φ)")
    modulation: Modulation = Modulation.SPWM
    t_ambient: float = Field(40.0, description="Ambient temperature (°C)")
    t_case: Optional[float] = Field(None, description="Case temperature (°C), overrides heatsink calc if set")
    rth_ha: Optional[float] = Field(None, description="Heatsink-to-ambient Rth (K/W)")

    class Config:
        use_enum_values = True


# ── Per-device loss breakdown ─────────────────────────────────────────

class DeviceLoss(BaseModel):
    """Loss breakdown for a single semiconductor device."""
    name: str                          # e.g. "IGBT_H_U", "SiC_MOS_H_U"
    type: str = ""                     # "IGBT", "SiC MOSFET", "Diode", "Body Diode"
    p_cond: float = 0.0                # Conduction loss (W)
    p_sw: float = 0.0                  # Switching loss (W)
    p_total: float = 0.0               # Total loss (W)
    t_j: float = 0.0                   # Junction temperature (°C)
    i_avg: float = 0.0                 # Average current (A)
    i_rms: float = 0.0                 # RMS current (A)
    duty_cycle: float = 0.0            # Effective duty cycle
    conduction_details: Optional[dict] = None
    switching_details: Optional[dict] = None


# ── Top-level results ─────────────────────────────────────────────────

class CalculationResult(BaseModel):
    """Complete calculation result returned to frontend."""
    device_type: DeviceType
    module_name: str
    conditions: OperatingConditions

    # Summary
    p_total_loss: float                # Total module loss (W)
    p_igbt_cond: float                 # All IGBT conduction loss
    p_igbt_sw: float                   # All IGBT switching loss
    p_diode_cond: float                 # All diode conduction loss
    p_diode_sw: float                   # All diode recovery loss
    p_brake_loss: float = 0.0          # Brake chopper loss (W)
    efficiency: float                  # η = Pout/(Pout+Ploss)
    p_out: float                       # Output power (W)

    # Thermal
    t_j_max: float                     # Max junction temp across all devices
    t_j_max_device: str                 # Which device has max Tj
    t_case_est: float                  # Estimated case temperature
    t_heatsink_est: Optional[float] = None

    # Detail
    devices: list[DeviceLoss]          # Per-device breakdown
    iteration_count: int               # Thermal iteration count
    converged: bool                    # Whether thermal loop converged

    # Intermediate calculation steps (for display)
    calculation_steps: list[dict] = []

    # Optional per-leg detail
    per_leg: Optional[dict] = None


# ── Curve sweep request / response ────────────────────────────────────

class CalculateRequest(BaseModel):
    """Combined request for loss calculation."""
    config: ModuleConfigCompact
    conditions: OperatingConditions


class CurveRequest(BaseModel):
    """Request for characteristic curve sweep."""
    config: ModuleConfigCompact
    conditions: OperatingConditions
    sweep_param: str = "i_out"
    sweep_start: float = 1.0
    sweep_end: float = 100.0
    sweep_points: int = 50


class CurvePoint(BaseModel):
    """One point on a characteristic curve."""
    x: float
    y: float


class CurveData(BaseModel):
    """A named curve (loss, efficiency, Tj, etc.)."""
    name: str
    x_label: str
    y_label: str
    points: list[CurvePoint]


class CurveSweepResult(BaseModel):
    """Set of characteristic curves from a sweep."""
    curves: list[CurveData]
