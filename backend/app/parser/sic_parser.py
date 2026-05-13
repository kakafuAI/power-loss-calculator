"""SiC MOSFET-specific datasheet parameter extraction."""

from typing import Optional
from .pdf_reader import PDFExtractResult
from .patterns import (
    extract_float, extract_all_floats,
    RDS_ON_PATTERNS, EON_PATTERNS, EOFF_PATTERNS,
    VF_PATTERNS, RTH_JC_PATTERNS, RTH_CS_PATTERN,
    IC_NOM_PATTERNS,
)


class SiCExtractedParams:
    """Container for extracted SiC MOSFET parameters with confidence scores."""

    def __init__(self):
        self.rds_on_25: Optional[float] = None
        self.rds_on_125: Optional[float] = None
        self.vds_rated: Optional[float] = None
        self.id_nom: Optional[float] = None
        self.vsd_25: Optional[float] = None      # Body diode forward voltage
        self.vsd_125: Optional[float] = None
        self.eon: Optional[float] = None
        self.eoff: Optional[float] = None
        self.err: Optional[float] = None          # SiC diodes have near-zero Err
        self.qrr: Optional[float] = None          # Near-zero for SiC
        self.eon_id_ref: Optional[float] = None
        self.eoff_id_ref: Optional[float] = None
        self.eon_vdd_ref: Optional[float] = None
        self.eoff_vdd_ref: Optional[float] = None
        self.eon_rg_ref: Optional[float] = None
        self.eoff_rg_ref: Optional[float] = None
        self.rth_jc_mos: Optional[float] = None
        self.rth_jc_diode: Optional[float] = None
        self.rth_cs: Optional[float] = None
        self.confidence: dict = {}


def extract_sic_params(result: PDFExtractResult) -> SiCExtractedParams:
    """
    Extract SiC MOSFET parameters from PDF result.
    """
    params = SiCExtractedParams()
    text = result.full_text

    # ── Rds(on) ───────────────────────────────────────────────────────
    rds_vals = []
    for pat in RDS_ON_PATTERNS:
        v = extract_float(text, pat)
        if v is not None:
            rds_vals.append(v)

    if len(rds_vals) >= 2:
        params.rds_on_25 = rds_vals[0]
        params.rds_on_125 = rds_vals[1]
        params.confidence["rds_on_25"] = 0.85
        params.confidence["rds_on_125"] = 0.75
    elif len(rds_vals) == 1:
        params.rds_on_25 = rds_vals[0]
        # SiC Rds(on) roughly doubles from 25 to 125°C
        params.rds_on_125 = rds_vals[0] * 1.6
        params.confidence["rds_on_25"] = 0.85
        params.confidence["rds_on_125"] = 0.3  # Estimated

    # If value seems like mΩ rather than Ω, keep as-is (mΩ is standard)
    # If value > 10, it might be mΩ already

    # ── Vds rated ─────────────────────────────────────────────────────
    from .patterns import VCES_PATTERN
    params.vds_rated = extract_float(text, VCES_PATTERN)
    if not params.vds_rated:
        # Try SiC-specific Vds pattern
        import re
        vds_pat = re.compile(r'V[Dd][Ss]\s*.*?(?:max)?\s*([\d.]+)\s*V', re.IGNORECASE)
        params.vds_rated = extract_float(text, vds_pat)
    if params.vds_rated:
        params.confidence["vds_rated"] = 0.9

    # ── Nominal Id ────────────────────────────────────────────────────
    import re
    id_pats = [
        re.compile(r'I[Dd]\s*(?:nom)?\s*.*?Tc\s*=\s*(?:80|100|25)\s*°?C.*?([\d.]+)\s*A', re.IGNORECASE),
        re.compile(r'Drain\s*current.*?(?:nominal|rated|DC).*?([\d.]+)\s*A', re.IGNORECASE),
    ]
    for pat in id_pats:
        params.id_nom = extract_float(text, pat)
        if params.id_nom:
            params.confidence["id_nom"] = 0.8
            break

    # ── Switching energies ────────────────────────────────────────────
    sw_section = result.get_section("switching", 30)
    sw_text = sw_section if sw_section else text

    eon_match = None
    for pat in EON_PATTERNS:
        match = pat.search(sw_text)
        if match:
            eon_match = match
            break
    if eon_match:
        groups = eon_match.groups()
        if len(groups) >= 4:
            params.eon_id_ref = float(groups[0])
            params.eon_vdd_ref = float(groups[1])
            params.eon_rg_ref = float(groups[2])
            params.eon = float(groups[3])
            params.confidence["eon"] = 0.85
        elif len(groups) >= 2:
            params.eon = float(groups[0])
            params.eon_id_ref = float(groups[1])
            params.confidence["eon"] = 0.6

    eoff_match = None
    for pat in EOFF_PATTERNS:
        match = pat.search(sw_text)
        if match:
            eoff_match = match
            break
    if eoff_match:
        groups = eoff_match.groups()
        if len(groups) >= 4:
            params.eoff_id_ref = float(groups[0])
            params.eoff_vdd_ref = float(groups[1])
            params.eoff_rg_ref = float(groups[2])
            params.eoff = float(groups[3])
            params.confidence["eoff"] = 0.85
        elif len(groups) >= 2:
            params.eoff = float(groups[0])
            params.eoff_id_ref = float(groups[1])
            params.confidence["eoff"] = 0.6

    # ── Body diode Vsd ────────────────────────────────────────────────
    diode_section = result.get_section("body diode", 20)
    if not diode_section:
        diode_section = result.get_section("diode", 20)
    diode_text = diode_section if diode_section else text

    vf_vals = []
    for pat in VF_PATTERNS:
        v = extract_float(diode_text, pat)
        if v is not None and v < 10:
            vf_vals.append(v)
    if len(vf_vals) >= 2:
        params.vsd_25 = vf_vals[0]
        params.vsd_125 = vf_vals[1]
        params.confidence["vsd_25"] = 0.7
        params.confidence["vsd_125"] = 0.6
    elif len(vf_vals) == 1:
        params.vsd_25 = vf_vals[0]
        params.confidence["vsd_25"] = 0.6

    # SiC Err and Qrr are essentially zero
    params.err = 0.0
    params.qrr = 0.0
    params.confidence["err"] = 1.0  # Known physical property
    params.confidence["qrr"] = 1.0

    # ── Thermal resistances ───────────────────────────────────────────
    thermal_section = result.get_section("thermal", 20)
    th_text = thermal_section if thermal_section else text

    rth_vals = extract_all_floats(th_text, RTH_JC_PATTERNS[2])
    if rth_vals:
        params.rth_jc_mos = rth_vals[0]
        params.confidence["rth_jc_mos"] = 0.8
        if len(rth_vals) >= 2:
            params.rth_jc_diode = rth_vals[1]
            params.confidence["rth_jc_diode"] = 0.5

    params.rth_cs = extract_float(th_text, RTH_CS_PATTERN)
    if params.rth_cs:
        params.confidence["rth_cs"] = 0.6

    return params


def sic_params_to_dict(params: SiCExtractedParams) -> dict:
    """Convert extracted SiC params to a JSON-serializable dict."""
    return {
        "rds_on_25": params.rds_on_25,
        "rds_on_125": params.rds_on_125,
        "vds_rated": params.vds_rated,
        "id_nom": params.id_nom,
        "vsd_25": params.vsd_25,
        "vsd_125": params.vsd_125,
        "eon": params.eon,
        "eoff": params.eoff,
        "err": params.err,
        "qrr": params.qrr,
        "eon_id_ref": params.eon_id_ref,
        "eoff_id_ref": params.eoff_id_ref,
        "eon_vdd_ref": params.eon_vdd_ref,
        "eoff_vdd_ref": params.eoff_vdd_ref,
        "eon_rg_ref": params.eon_rg_ref,
        "eoff_rg_ref": params.eoff_rg_ref,
        "rth_jc_mos": params.rth_jc_mos,
        "rth_jc_diode": params.rth_jc_diode,
        "rth_cs": params.rth_cs,
        "confidence": params.confidence,
    }
