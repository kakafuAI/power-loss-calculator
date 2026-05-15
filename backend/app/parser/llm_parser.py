"""DeepSeek LLM-based datasheet parameter extractor.

Uses the DeepSeek API (OpenAI-compatible) to extract power semiconductor
parameters from raw PDF text with high accuracy across diverse datasheet formats.
"""

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

from openai import OpenAI

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────


@dataclass
class LLMParserConfig:
    api_key: str = field(default_factory=lambda: os.getenv("DEEPSEEK_API_KEY", ""))
    base_url: str = "https://api.deepseek.com"
    model: str = "deepseek-chat"
    max_chars: int = 8000
    temperature: float = 0.0
    max_tokens: int = 2048


# ── Prompt templates ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a power semiconductor datasheet parameter extraction expert.
Your task is to extract electrical and thermal parameters from raw PDF text of a power device datasheet.

Rules:
1. Extract TYPICAL (typ) values whenever available. Ignore MAX/MIN unless typ is absent.
2. Distinguish 25°C and 125°C (or 150°C for SiC) values when both are present.
3. Normalize units: mΩ → keep as mΩ, V → V, A → A, mJ → mJ, K/W → K/W, nF → nF, μC → μC, ns → ns.
4. For switching energy (Eon, Eoff, Err), also extract the reference conditions: Ic/Id, Vcc/Vdd, Rg.
5. For multi-point switching energy curves, extract ALL (current, energy) pairs found in tables.
6. If a parameter is not found in the text, set it to null.
7. Return ONLY valid JSON — no markdown, no code fences, no comments.
8. Assign a confidence score 0.0-1.0 for each extracted value based on how clearly it was identified."""

IGBT_SCHEMA = """
{
  "vce_sat_25": number | null,       // Vce(sat) @ 25°C in V (typ)
  "vce_sat_125": number | null,      // Vce(sat) @ 125°C (or 150°C) in V (typ)
  "vce_rated": number | null,        // VCES / collector-emitter breakdown voltage in V
  "ic_nom": number | null,           // Nominal collector current at Tc=80°C or 100°C in A
  "vf_25": number | null,            // Diode forward voltage @ 25°C in V (typ)
  "vf_125": number | null,           // Diode forward voltage @ 125°C in V (typ)
  "if_nom": number | null,           // Nominal diode forward current in A
  "eon": number | null,              // Turn-on energy at nominal current in mJ (typ)
  "eoff": number | null,             // Turn-off energy at nominal current in mJ (typ)
  "err": number | null,              // Reverse recovery energy in mJ (typ)
  "eon_ic_ref": number | null,       // Reference Ic for Eon in A
  "eon_vcc_ref": number | null,      // Reference Vcc for Eon in V
  "eon_rg_ref": number | null,       // Reference Rg for Eon in Ω
  "eoff_ic_ref": number | null,      // Reference Ic for Eoff in A
  "eoff_vcc_ref": number | null,     // Reference Vcc for Eoff in V
  "eoff_rg_ref": number | null,      // Reference Rg for Eoff in Ω
  "err_if_ref": number | null,       // Reference If for Err in A
  "err_vr_ref": number | null,       // Reference Vr for Err in V
  "eon_points": [[current_A, energy_mJ], ...] | [],   // Multi-point Eon curve
  "eoff_points": [[current_A, energy_mJ], ...] | [],  // Multi-point Eoff curve
  "err_points": [[current_A, energy_mJ], ...] | [],   // Multi-point Err curve
  "rth_jc_igbt": number | null,      // Junction-to-case thermal resistance IGBT in K/W
  "rth_jc_diode": number | null,     // Junction-to-case thermal resistance Diode in K/W
  "rth_cs": number | null,           // Case-to-sink thermal resistance in K/W (with grease)
  "rg_int": number | null,           // Internal gate resistance in Ω
  "t_j_max": number | null,          // Maximum junction temperature in °C
  "ton": number | null,              // Turn-on time in ns (typ)
  "toff": number | null,             // Turn-off time in ns (typ)
  "cies": number | null,             // Input capacitance in nF (typ)
  "qrr": number | null,              // Reverse recovery charge in μC (typ)
  "confidence": { "<param_name>": 0.0-1.0 }  // Per-parameter confidence
}"""

SIC_SCHEMA = """
{
  "rds_on_25": number | null,        // Rds(on) @ 25°C in mΩ (typ)
  "rds_on_125": number | null,       // Rds(on) @ 125°C or 150°C in mΩ (typ)
  "vds_rated": number | null,        // Drain-source breakdown voltage in V
  "id_nom": number | null,           // Nominal drain current at Tc=80°C or 100°C in A
  "vsd_25": number | null,           // Body diode forward voltage @ 25°C in V (typ)
  "vsd_125": number | null,          // Body diode forward voltage @ 125°C in V (typ)
  "eon": number | null,              // Turn-on energy at nominal current in mJ (typ)
  "eoff": number | null,             // Turn-off energy at nominal current in mJ (typ)
  "err": 0,                          // SiC diodes have negligible reverse recovery
  "eon_id_ref": number | null,       // Reference Id for Eon in A
  "eon_vdd_ref": number | null,      // Reference Vdd for Eon in V
  "eon_rg_ref": number | null,       // Reference Rg for Eon in Ω
  "eoff_id_ref": number | null,      // Reference Id for Eoff in A
  "eoff_vdd_ref": number | null,     // Reference Vdd for Eoff in V
  "eoff_rg_ref": number | null,      // Reference Rg for Eoff in Ω
  "eon_points": [[current_A, energy_mJ], ...] | [],   // Multi-point Eon curve
  "eoff_points": [[current_A, energy_mJ], ...] | [],  // Multi-point Eoff curve
  "rth_jc_mos": number | null,       // Junction-to-case thermal resistance MOSFET in K/W
  "rth_jc_diode": number | null,     // Junction-to-case thermal resistance Diode in K/W
  "rth_cs": number | null,           // Case-to-sink thermal resistance in K/W
  "rg_int": number | null,           // Internal gate resistance in Ω
  "t_j_max": number | null,          // Maximum junction temperature in °C
  "cies": number | null,             // Input capacitance in nF (typ)
  "qrr": 0,                          // SiC diodes have negligible Qrr
  "confidence": { "<param_name>": 0.0-1.0 }  // Per-parameter confidence
}"""


def _build_user_prompt(text: str, device_type: str) -> str:
    """Build the user prompt with truncated PDF text and expected output schema."""
    truncated = text[:8000] if len(text) > 8000 else text
    schema = SIC_SCHEMA if "sic" in device_type.lower() else IGBT_SCHEMA
    device_label = "SiC MOSFET" if "sic" in device_type.lower() else "IGBT"

    return f"""Extract {device_label} parameters from the following datasheet text.

Return a JSON object matching this schema exactly:
{schema}

Datasheet text:
---
{truncated}
---"""


# ── Main extraction function ───────────────────────────────────────────────


def extract_params_via_llm(
    text: str,
    device_type: str,
    config: Optional[LLMParserConfig] = None,
) -> dict:
    """
    Extract device parameters from datasheet text using DeepSeek LLM.

    Args:
        text: Raw text extracted from PDF
        device_type: 'igbt_module', 'sic_module', etc.
        config: Optional parser configuration

    Returns:
        Dict with extracted parameters (compatible with igbt_to_dict / sic_params_to_dict)

    Raises:
        ValueError: If no API key configured
        RuntimeError: If LLM call fails or response is unparseable
    """
    cfg = config or LLMParserConfig()
    if not cfg.api_key:
        raise ValueError("DEEPSEEK_API_KEY not configured")

    client = OpenAI(api_key=cfg.api_key, base_url=cfg.base_url)

    response = client.chat.completions.create(
        model=cfg.model,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(text, device_type)},
        ],
    )

    raw = response.choices[0].message.content
    if not raw:
        raise RuntimeError("Empty response from LLM")

    parsed = json.loads(raw)
    return _validate_and_clean(parsed, device_type)


def _validate_and_clean(parsed: dict, device_type: str) -> dict:
    """Validate extracted values and apply sanity bounds. Returns cleaned dict."""
    is_sic = "sic" in device_type.lower()

    # ── Numeric bounds for sanity ───────────────────────────────────────
    bounds: dict[str, tuple[float, float]] = {}
    if is_sic:
        bounds = {
            "rds_on_25": (1, 5000), "rds_on_125": (1, 5000),
            "vds_rated": (100, 10000), "id_nom": (1, 2000),
            "vsd_25": (0.5, 10), "vsd_125": (0.5, 10),
            "eon": (0.001, 500), "eoff": (0.001, 500),
            "rth_jc_mos": (0.01, 10), "rth_jc_diode": (0.01, 10),
            "rth_cs": (0.001, 5), "rg_int": (0.1, 100),
            "t_j_max": (100, 250), "cies": (0.01, 1000),
        }
    else:
        bounds = {
            "vce_sat_25": (0.5, 10), "vce_sat_125": (0.5, 10),
            "vce_rated": (100, 10000), "ic_nom": (1, 5000),
            "vf_25": (0.5, 5), "vf_125": (0.5, 5), "if_nom": (1, 5000),
            "eon": (0.001, 1000), "eoff": (0.001, 1000), "err": (0.001, 500),
            "rth_jc_igbt": (0.01, 10), "rth_jc_diode": (0.01, 10),
            "rth_cs": (0.001, 5), "rg_int": (0.1, 100),
            "t_j_max": (100, 250), "ton": (1, 5000), "toff": (1, 5000),
            "cies": (0.01, 1000), "qrr": (0.01, 500),
        }

    cleaned: dict = {}
    for key, (lo, hi) in bounds.items():
        val = parsed.get(key)
        if val is not None and isinstance(val, (int, float)):
            if lo <= val <= hi:
                cleaned[key] = float(val)
        elif key not in parsed or parsed.get(key) is None:
            cleaned[key] = None

    # ── Pass through reference values (no bounds needed) ────────────────
    ref_keys = (
        ["eon_id_ref", "eon_vdd_ref", "eon_rg_ref",
         "eoff_id_ref", "eoff_vdd_ref", "eoff_rg_ref"]
        if is_sic else
        ["eon_ic_ref", "eon_vcc_ref", "eon_rg_ref",
         "eoff_ic_ref", "eoff_vcc_ref", "eoff_rg_ref",
         "err_if_ref", "err_vr_ref"]
    )
    for key in ref_keys:
        val = parsed.get(key)
        if val is not None and isinstance(val, (int, float)):
            cleaned[key] = float(val)
        else:
            cleaned[key] = None

    # ── Multi-point curves ──────────────────────────────────────────────
    curve_keys = (
        ["eon_points", "eoff_points"] if is_sic
        else ["eon_points", "eoff_points", "err_points"]
    )
    for key in curve_keys:
        pts = parsed.get(key, [])
        if isinstance(pts, list) and len(pts) >= 1:
            valid = []
            for pt in pts:
                if isinstance(pt, list) and len(pt) == 2:
                    try:
                        cur, ene = float(pt[0]), float(pt[1])
                        if 0.1 <= cur <= 5000 and 0.001 <= ene <= 1000:
                            valid.append([cur, ene])
                    except (ValueError, TypeError):
                        continue
            cleaned[key] = valid
        else:
            cleaned[key] = []

    # ── Confidence ──────────────────────────────────────────────────────
    confidence = parsed.get("confidence", {})
    if isinstance(confidence, dict):
        cleaned["confidence"] = {
            k: float(v) for k, v in confidence.items()
            if isinstance(v, (int, float))
        }
    else:
        cleaned["confidence"] = {}

    # ── Carry over SiC-specific known values ────────────────────────────
    if is_sic:
        cleaned["err"] = 0.0
        cleaned["qrr"] = 0.0
        if "err" not in cleaned["confidence"]:
            cleaned["confidence"]["err"] = 1.0
        if "qrr" not in cleaned["confidence"]:
            cleaned["confidence"]["qrr"] = 1.0

    # ── Carry over passthrough keys that may not be in bounds ───────────
    for optional_key in ["ton", "toff", "qrr"]:
        if optional_key not in cleaned:
            val = parsed.get(optional_key)
            if val is not None and isinstance(val, (int, float)):
                cleaned[optional_key] = float(val)
            else:
                cleaned[optional_key] = None

    return cleaned


def llm_result_to_igbt_dict(cleaned: dict) -> dict:
    """Convert LLM-extracted dict to the format expected by igbt_to_dict()."""
    return {
        "vce_sat_25": cleaned.get("vce_sat_25"),
        "vce_sat_125": cleaned.get("vce_sat_125"),
        "vce_rated": cleaned.get("vce_rated"),
        "ic_nom": cleaned.get("ic_nom"),
        "vf_25": cleaned.get("vf_25"),
        "vf_125": cleaned.get("vf_125"),
        "if_nom": cleaned.get("if_nom"),
        "eon": cleaned.get("eon"),
        "eoff": cleaned.get("eoff"),
        "err": cleaned.get("err"),
        "qrr": cleaned.get("qrr"),
        "eon_ic_ref": cleaned.get("eon_ic_ref"),
        "eoff_ic_ref": cleaned.get("eoff_ic_ref"),
        "eon_vcc_ref": cleaned.get("eon_vcc_ref"),
        "eoff_vcc_ref": cleaned.get("eoff_vcc_ref"),
        "eon_rg_ref": cleaned.get("eon_rg_ref"),
        "eoff_rg_ref": cleaned.get("eoff_rg_ref"),
        "err_if_ref": cleaned.get("err_if_ref"),
        "err_vr_ref": cleaned.get("err_vr_ref"),
        "rth_jc_igbt": cleaned.get("rth_jc_igbt"),
        "rth_jc_diode": cleaned.get("rth_jc_diode"),
        "rth_cs": cleaned.get("rth_cs"),
        "rg_int": cleaned.get("rg_int"),
        "t_j_max": cleaned.get("t_j_max"),
        "ton": cleaned.get("ton"),
        "toff": cleaned.get("toff"),
        "cies": cleaned.get("cies"),
        "eon_points": cleaned.get("eon_points", []),
        "eoff_points": cleaned.get("eoff_points", []),
        "err_points": cleaned.get("err_points", []),
        "confidence": cleaned.get("confidence", {}),
    }


def llm_result_to_sic_dict(cleaned: dict) -> dict:
    """Convert LLM-extracted dict to the format expected by sic_params_to_dict()."""
    return {
        "rds_on_25": cleaned.get("rds_on_25"),
        "rds_on_125": cleaned.get("rds_on_125"),
        "vds_rated": cleaned.get("vds_rated"),
        "id_nom": cleaned.get("id_nom"),
        "vsd_25": cleaned.get("vsd_25"),
        "vsd_125": cleaned.get("vsd_125"),
        "eon": cleaned.get("eon"),
        "eoff": cleaned.get("eoff"),
        "err": cleaned.get("err", 0.0),
        "qrr": cleaned.get("qrr", 0.0),
        "eon_id_ref": cleaned.get("eon_id_ref"),
        "eoff_id_ref": cleaned.get("eoff_id_ref"),
        "eon_vdd_ref": cleaned.get("eon_vdd_ref"),
        "eoff_vdd_ref": cleaned.get("eoff_vdd_ref"),
        "eon_rg_ref": cleaned.get("eon_rg_ref"),
        "eoff_rg_ref": cleaned.get("eoff_rg_ref"),
        "rth_jc_mos": cleaned.get("rth_jc_mos"),
        "rth_jc_diode": cleaned.get("rth_jc_diode"),
        "rth_cs": cleaned.get("rth_cs"),
        "rg_int": cleaned.get("rg_int"),
        "t_j_max": cleaned.get("t_j_max"),
        "cies": cleaned.get("cies"),
        "eon_points": cleaned.get("eon_points", []),
        "eoff_points": cleaned.get("eoff_points", []),
        "confidence": cleaned.get("confidence", {}),
    }
