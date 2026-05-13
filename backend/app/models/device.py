"""Device parameter models for IGBT, SiC MOSFET, modules, and discretes."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class DeviceType(str, Enum):
    IGBT_MODULE = "igbt_module"
    IPM_MODULE = "ipm_module"
    IGBT_DISCRETE = "igbt_discrete"
    SIC_MODULE = "sic_module"
    SIC_DISCRETE = "sic_discrete"


class Topology(str, Enum):
    THREE_PHASE_INVERTER = "three_phase_inverter"


class Modulation(str, Enum):
    SPWM = "spwm"
    SVPWM = "svpwm"


# ── Switching energy data points ──────────────────────────────────────

class SwitchingPoint(BaseModel):
    """A single (Ic, E) data point for switching energy curves."""
    current: float  # A
    energy: float   # mJ


class SwitchingCurve(BaseModel):
    """Switching energy vs collector current, at a given Vcc and Rg."""
    vcc: float = 600.0       # DC link voltage (V)
    rg: float = 10.0         # Gate resistance (Ω)
    tj: float = 125.0        # Junction temp (°C)
    points: list[SwitchingPoint] = []


# ── Device thermal parameters ─────────────────────────────────────────

class ThermalParams(BaseModel):
    """Foster RC thermal network parameters (per device)."""
    rth_jc: float = 0.0     # Junction-to-case (K/W)
    rth_ch: Optional[float] = None  # Case-to-heatsink (K/W), per-module
    rth_ha: Optional[float] = None  # Heatsink-to-ambient (K/W), system-level
    tau: Optional[list[float]] = None  # Time constants (s) for Foster network
    r: Optional[list[float]] = None    # Thermal resistances matching tau


# ── IGBT parameters ───────────────────────────────────────────────────

class IGBTParams(BaseModel):
    """IGBT chip parameters extracted from datasheet."""
    vce_sat_25: float       # Vce(sat) at 25°C (V)
    vce_sat_125: float      # Vce(sat) at 125°C (V)
    ic_nom: float           # Nominal collector current (A)
    vce_rated: float        # Rated Vce (V), e.g. 1200
    eon_curve: SwitchingCurve
    eoff_curve: SwitchingCurve
    thermal: ThermalParams
    rg_int: Optional[float] = None   # Internal gate resistance (Ω)


class DiodeParams(BaseModel):
    """Free-wheeling diode parameters."""
    vf_25: float            # Forward voltage at 25°C (V)
    vf_125: float           # Forward voltage at 125°C (V)
    if_nom: float            # Nominal forward current (A)
    err_curve: SwitchingCurve  # Reverse recovery energy vs If
    qrr: float = 0.0        # Reverse recovery charge (μC)
    thermal: ThermalParams


# ── SiC MOSFET parameters ─────────────────────────────────────────────

class SiCMOSParams(BaseModel):
    """SiC MOSFET chip parameters."""
    rds_on_25: float        # Rds(on) at 25°C (mΩ)
    rds_on_125: float       # Rds(on) at 125°C (mΩ)
    id_nom: float           # Nominal drain current (A)
    vds_rated: float        # Rated Vds (V)
    eon_curve: SwitchingCurve
    eoff_curve: SwitchingCurve
    thermal: ThermalParams
    rg_int: Optional[float] = None


class SiCDiodeParams(BaseModel):
    """SiC body diode / external Schottky parameters."""
    vsd_25: float           # Body diode forward voltage at 25°C (V)
    vsd_125: float          # Body diode forward voltage at 125°C (V)
    if_nom: float            # Nominal forward current (A)
    err_curve: Optional[SwitchingCurve] = None  # SiC diodes have near-zero Err
    qrr: float = 0.0        # Near-zero for SiC
    thermal: ThermalParams


# ── Module configuration ──────────────────────────────────────────────

class ArmConfig(BaseModel):
    """One phase arm: high-side IGBT + low-side IGBT + their diodes."""
    igbt_high: IGBTParams
    igbt_low: IGBTParams
    diode_high: DiodeParams
    diode_low: DiodeParams


class BrakeChopperConfig(BaseModel):
    """Brake chopper: one IGBT + one diode."""
    igbt: IGBTParams
    diode: DiodeParams


class ModuleConfig(BaseModel):
    """Full module device configuration."""
    device_type: DeviceType
    module_name: str = ""
    manufacturer: str = ""
    vdc_rated: float        # Rated DC link voltage (V)
    ic_rated: float          # Rated output current (A)

    # Three-phase inverter arms
    arm_u: Optional[ArmConfig] = None
    arm_v: Optional[ArmConfig] = None
    arm_w: Optional[ArmConfig] = None
    brake: Optional[BrakeChopperConfig] = None

    # Module-level thermal
    rth_ch_module: Optional[float] = None  # Case-to-heatsink per module (K/W)
    rth_ha: Optional[float] = None         # Heatsink-to-ambient (K/W)
    t_j_max: float = 150.0                # Max junction temperature (°C)

    # SiC variant parameters
    igbt_params: Optional[IGBTParams] = None
    diode_params: Optional[DiodeParams] = None
    sic_mos_params: Optional[SiCMOSParams] = None
    sic_diode_params: Optional[SiCDiodeParams] = None


class ModuleConfigCompact(BaseModel):
    """Compact config when all 6 switches are identical (common case)."""
    device_type: DeviceType
    module_name: str = ""
    manufacturer: str = ""
    vdc_rated: float
    ic_rated: float
    num_parallel_chips: int = 1

    # IGBT / SiC switch params (choose one set)
    igbt: Optional[IGBTParams] = None
    sic_mos: Optional[SiCMOSParams] = None
    diode: Optional[DiodeParams] = None
    sic_diode: Optional[SiCDiodeParams] = None

    # Brake chopper
    brake_igbt: Optional[IGBTParams] = None
    brake_diode: Optional[DiodeParams] = None

    # Module-level thermal
    rth_ch_module: Optional[float] = None
    rth_ha: Optional[float] = None
    t_j_max: float = 150.0
