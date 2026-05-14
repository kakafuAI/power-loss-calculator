"""IGBT-specific datasheet parameter extraction."""

from typing import Optional
from .pdf_reader import PDFExtractResult
from .patterns import (
    extract_float, extract_with_confidence, extract_all_floats,
    VCE_SAT_PATTERNS, VCES_PATTERN, IC_NOM_PATTERNS,
    EON_PATTERNS, EOFF_PATTERNS, ERR_PATTERNS,
    VF_PATTERNS, RTH_JC_PATTERNS, RTH_CS_PATTERN, QRR_PATTERN,
)


class IGBTExtractedParams:
    """Container for extracted IGBT/diode parameters with confidence scores."""

    def __init__(self):
        self.vce_sat_25: Optional[float] = None
        self.vce_sat_125: Optional[float] = None
        self.vce_rated: Optional[float] = None
        self.ic_nom: Optional[float] = None
        self.vf_25: Optional[float] = None
        self.vf_125: Optional[float] = None
        self.eon: Optional[float] = None
        self.eoff: Optional[float] = None
        self.err: Optional[float] = None
        self.qrr: Optional[float] = None
        self.eon_ic_ref: Optional[float] = None
        self.eoff_ic_ref: Optional[float] = None
        self.eon_vcc_ref: Optional[float] = None
        self.eoff_vcc_ref: Optional[float] = None
        self.eon_rg_ref: Optional[float] = None
        self.eoff_rg_ref: Optional[float] = None
        self.rth_jc_igbt: Optional[float] = None
        self.rth_jc_diode: Optional[float] = None
        # v1.2.0新增
        self.rg_int: Optional[float] = None
        self.t_j_max: Optional[float] = None
        self.ton: Optional[float] = None
        self.toff: Optional[float] = None
        self.cies: Optional[float] = None
        self.eon_points: list = []
        self.eoff_points: list = []
        self.err_points: list = []
        self.rth_cs: Optional[float] = None
        self.confidence: dict = {}


def extract_igbt_params(result: PDFExtractResult) -> IGBTExtractedParams:
    """
    Extract IGBT module parameters from PDF result.

    Searches the full extracted text and tables with multi-pattern matching.
    """
    params = IGBTExtractedParams()
    text = result.full_text

    # ── Vce(sat) ──────────────────────────────────────────────────────
    # Try to find the electrical characteristics table first
    section = result.get_section("electrical characteristics", 30)
    search_text = section if section else text

    # Vce(sat) @ 25°C
    val_25 = None
    for pat in VCE_SAT_PATTERNS:
        val_25 = extract_float(search_text, pat)
        if val_25 is not None and val_25 < 10:  # Sanity check
            params.vce_sat_25 = val_25
            params.confidence["vce_sat_25"] = 0.85
            break

    # Vce(sat) @ 125°C - look for second occurrence
    vals = extract_all_floats(search_text, VCE_SAT_PATTERNS[2]) if len(VCE_SAT_PATTERNS) > 2 else []
    if len(vals) >= 2:
        params.vce_sat_125 = vals[1]
    elif len(vals) == 1 and params.vce_sat_25 is not None:
        # Found only 25C value, use typical scaling
        params.vce_sat_125 = vals[0]
    if params.vce_sat_125:
        params.confidence["vce_sat_125"] = 0.7

    # ── VCES (rated voltage) ──────────────────────────────────────────
    params.vce_rated = extract_float(text, VCES_PATTERN)
    if params.vce_rated:
        params.confidence["vce_rated"] = 0.9

    # ── Nominal Ic ────────────────────────────────────────────────────
    for pat in IC_NOM_PATTERNS:
        params.ic_nom = extract_float(text, pat)
        if params.ic_nom:
            params.confidence["ic_nom"] = 0.8
            break

    # ── Switching energies ────────────────────────────────────────────
    sw_section = result.get_section("switching", 30)
    sw_text = sw_section if sw_section else text

    # Eon
    eon_match = None
    for pat in EON_PATTERNS:
        match = pat.search(sw_text)
        if match:
            eon_match = match
            break
    if eon_match:
        groups = eon_match.groups()
        if len(groups) >= 4:
            params.eon_ic_ref = float(groups[0])
            params.eon_vcc_ref = float(groups[1])
            params.eon_rg_ref = float(groups[2])
            params.eon = float(groups[3])
            params.confidence["eon"] = 0.85
        elif len(groups) >= 2:
            params.eon = float(groups[0])
            params.eon_ic_ref = float(groups[1])
            params.confidence["eon"] = 0.6

    # Eoff
    eoff_match = None
    for pat in EOFF_PATTERNS:
        match = pat.search(sw_text)
        if match:
            eoff_match = match
            break
    if eoff_match:
        groups = eoff_match.groups()
        if len(groups) >= 4:
            params.eoff_ic_ref = float(groups[0])
            params.eoff_vcc_ref = float(groups[1])
            params.eoff_rg_ref = float(groups[2])
            params.eoff = float(groups[3])
            params.confidence["eoff"] = 0.85
        elif len(groups) >= 2:
            params.eoff = float(groups[0])
            params.eoff_ic_ref = float(groups[1])
            params.confidence["eoff"] = 0.6

    # Err
    err_match = None
    for pat in ERR_PATTERNS:
        match = pat.search(sw_text)
        if match:
            err_match = match
            break
    if err_match:
        groups = err_match.groups()
        if len(groups) >= 3:
            params.err = float(groups[-1])
            params.confidence["err"] = 0.8
        elif len(groups) >= 1:
            params.err = float(groups[0])
            params.confidence["err"] = 0.5

    # ── Diode Vf ──────────────────────────────────────────────────────
    diode_section = result.get_section("diode", 20)
    diode_text = diode_section if diode_section else text

    vf_vals = []
    for pat in VF_PATTERNS:
        v = extract_float(diode_text, pat)
        if v is not None and v < 5:  # Sanity: Vf < 5V
            vf_vals.append(v)

    if len(vf_vals) >= 2:
        params.vf_25 = vf_vals[0]
        params.vf_125 = vf_vals[1]
        params.confidence["vf_25"] = 0.7
        params.confidence["vf_125"] = 0.6
    elif len(vf_vals) == 1:
        params.vf_25 = vf_vals[0]
        params.confidence["vf_25"] = 0.6

    # ── Qrr ───────────────────────────────────────────────────────────
    params.qrr = extract_float(diode_text, QRR_PATTERN)
    if params.qrr:
        params.confidence["qrr"] = 0.7

    # ── v1.2.0 新增提取 ──────────────────────────────────────────────
    from .patterns import (
        RG_INT_PATTERNS, TJ_MAX_PATTERNS, TON_PATTERN, TOFF_PATTERN,
        TR_PATTERN, TF_PATTERN, CIES_PATTERN, COES_PATTERN, CRES_PATTERN,
        QG_PATTERN, RTH_CS_GREASE, extract_table_rows,
    )

    for pat in RG_INT_PATTERNS:
        v = extract_float(text, pat)
        if v is not None and 0.1 < v < 100:
            params.rg_int = v
            params.confidence["rg_int"] = 0.7
            break

    for pat in TJ_MAX_PATTERNS:
        v = extract_float(text, pat)
        if v is not None and 100 < v < 250:
            params.t_j_max = v
            params.confidence["t_j_max"] = 0.8
            break

    # Switching times
    ton = extract_float(sw_text, TON_PATTERN)
    if ton: params.confidence["ton"] = 0.6
    toff = extract_float(sw_text, TOFF_PATTERN)
    if toff: params.confidence["toff"] = 0.6

    # Capacitances
    cies = extract_float(text, CIES_PATTERN)
    if cies: params.confidence["cies"] = 0.6

    # Multi-point switching energy curve from tables
    eon_pts = extract_table_rows(sw_text, "Eon")
    if len(eon_pts) >= 2:
        params.eon_points = eon_pts
        params.confidence["eon_points"] = 0.8

    eoff_pts = extract_table_rows(sw_text, "Eoff")
    if len(eoff_pts) >= 2:
        params.eoff_points = eoff_pts
        params.confidence["eoff_points"] = 0.8

    err_pts = extract_table_rows(sw_text, "Err")
    if len(err_pts) >= 2:
        params.err_points = err_pts
        params.confidence["err_points"] = 0.8

    # Rth(c-s) with grease
    rth_cs_g = extract_float(text, RTH_CS_GREASE)
    if rth_cs_g:
        params.rth_cs = rth_cs_g
        params.confidence["rth_cs"] = 0.7

    # ── Thermal resistances ───────────────────────────────────────────
    thermal_section = result.get_section("thermal", 20)
    th_text = thermal_section if thermal_section else text

    # Rth(j-c) IGBT
    rth_vals = extract_all_floats(th_text, RTH_JC_PATTERNS[0])
    if not rth_vals:
        rth_vals = extract_all_floats(th_text, RTH_JC_PATTERNS[2])
    if rth_vals:
        params.rth_jc_igbt = rth_vals[0]
        params.confidence["rth_jc_igbt"] = 0.8

    # Rth(j-c) Diode
    rth_d_vals = extract_all_floats(th_text, RTH_JC_PATTERNS[1])
    if rth_d_vals:
        params.rth_jc_diode = rth_d_vals[0]
        params.confidence["rth_jc_diode"] = 0.7
    elif len(rth_vals) >= 2:
        params.rth_jc_diode = rth_vals[1]
        params.confidence["rth_jc_diode"] = 0.5

    # Rth(c-s)
    params.rth_cs = extract_float(th_text, RTH_CS_PATTERN)
    if params.rth_cs:
        params.confidence["rth_cs"] = 0.6

    return params


def params_to_dict(params: IGBTExtractedParams) -> dict:
    """Convert extracted params to a JSON-serializable dict for the API response."""
    return {
        "vce_sat_25": params.vce_sat_25,
        "vce_sat_125": params.vce_sat_125,
        "vce_rated": params.vce_rated,
        "ic_nom": params.ic_nom,
        "vf_25": params.vf_25,
        "vf_125": params.vf_125,
        "eon": params.eon,
        "eoff": params.eoff,
        "err": params.err,
        "qrr": params.qrr,
        "eon_ic_ref": params.eon_ic_ref,
        "eoff_ic_ref": params.eoff_ic_ref,
        "eon_vcc_ref": params.eon_vcc_ref,
        "eoff_vcc_ref": params.eoff_vcc_ref,
        "eon_rg_ref": params.eon_rg_ref,
        "eoff_rg_ref": params.eoff_rg_ref,
        "rth_jc_igbt": params.rth_jc_igbt,
        "rth_jc_diode": params.rth_jc_diode,
        "rth_cs": params.rth_cs,
        # v1.2.0新增
        "rg_int": params.rg_int,
        "t_j_max": params.t_j_max,
        "ton": params.ton,
        "toff": params.toff,
        "cies": params.cies,
        "eon_points": params.eon_points,
        "eoff_points": params.eoff_points,
        "err_points": params.err_points,
        "confidence": params.confidence,
    }
