"""Regex patterns for extracting parameters from power semiconductor datasheets.

Patterns are designed to be brand-agnostic, covering common formats from:
Infineon, Mitsubishi, Fuji Electric, Semikron, ON Semi, ST, Rohm, Cree/Wolfspeed, etc.
"""

import re
from typing import Optional


# ── Voltage / Current ratings ─────────────────────────────────────────

# Vce(sat) or collector-emitter saturation voltage
# Matches: "VCE(sat)" "Vce(sat)" "VCEsat" with conditions
VCE_SAT_PATTERNS = [
    # Table row: VCE(sat) | Ic=XXA, VGE=15V | typ 1.7 | max 2.1 | V
    re.compile(
        r'V[Cc][Ee]\s*\(?\s*sat\s*\)?\s*.*?'
        r'(?:typ|typical|Typ)\s*\.?\s*([\d.]+)\s*V',
        re.IGNORECASE
    ),
    # VCE(sat) @ 25°C: "1.70 V"
    re.compile(
        r'V[Cc][Ee]\s*\(?\s*sat\s*\)?\s*.*?@\s*25\s*°?C.*?'
        r'([\d.]+)\s*V',
        re.IGNORECASE
    ),
    # VCE(sat) @ 125°C or 150°C
    re.compile(
        r'V[Cc][Ee]\s*\(?\s*sat\s*\)?\s*.*?@\s*(?:125|150|Tj\s*=\s*(?:125|150))\s*°?C.*?'
        r'([\d.]+)\s*V',
        re.IGNORECASE
    ),
]

# Collector-emitter breakdown voltage
VCES_PATTERN = re.compile(
    r'V[Cc][Ee][Ss]\s*.*?(?:max|min)?\s*([\d.]+)\s*V',
    re.IGNORECASE
)

# Nominal / rated collector current
IC_NOM_PATTERNS = [
    re.compile(r'I[Cc]\s*(?:nom)?\s*.*?Tc\s*=\s*(?:80|100|25)\s*°?C.*?([\d.]+)\s*A', re.IGNORECASE),
    re.compile(r'Collector\s*current.*?(?:nominal|rated|DC).*?([\d.]+)\s*A', re.IGNORECASE),
    re.compile(r'I[Cc]\s*.*?(?:rated|nom)\s*.*?([\d.]+)\s*A', re.IGNORECASE),
]

# ── Switching energy ──────────────────────────────────────────────────

# Eon: Turn-on energy loss
EON_PATTERNS = [
    # Table format: Eon | Ic=XXA, Vcc=XXXV, Rg=XXΩ | typ X.X | mJ
    re.compile(
        r'Eon\s*.*?Ic\s*=\s*([\d.]+)\s*A.*?V[Cc][Cc]\s*=\s*([\d.]+)\s*V.*?'
        r'Rg\s*=\s*([\d.]+)\s*Ω.*?(?:typ|Typ)\s*\.?\s*([\d.]+)\s*mJ',
        re.IGNORECASE
    ),
    # Simpler: Eon = XX mJ @ Ic=XXA
    re.compile(
        r'Eon\s*.*?([\d.]+)\s*mJ.*?Ic\s*=\s*([\d.]+)\s*A',
        re.IGNORECASE
    ),
]

# Eoff: Turn-off energy loss
EOFF_PATTERNS = [
    re.compile(
        r'Eoff\s*.*?Ic\s*=\s*([\d.]+)\s*A.*?V[Cc][Cc]\s*=\s*([\d.]+)\s*V.*?'
        r'Rg\s*=\s*([\d.]+)\s*Ω.*?(?:typ|Typ)\s*\.?\s*([\d.]+)\s*mJ',
        re.IGNORECASE
    ),
    re.compile(
        r'Eoff\s*.*?([\d.]+)\s*mJ.*?Ic\s*=\s*([\d.]+)\s*A',
        re.IGNORECASE
    ),
]

# Err: Reverse recovery energy
ERR_PATTERNS = [
    re.compile(
        r'Err?\s*.*?If?\s*=\s*([\d.]+)\s*A.*?V[Rr]\s*=\s*([\d.]+)\s*V.*?'
        r'(?:typ|Typ)\s*\.?\s*([\d.]+)\s*mJ',
        re.IGNORECASE
    ),
    re.compile(
        r'(?:Err|Erec)\s*.*?([\d.]+)\s*mJ',
        re.IGNORECASE
    ),
]

# ── Diode forward voltage ─────────────────────────────────────────────

VF_PATTERNS = [
    re.compile(
        r'V[Ff]\s*.*?If?\s*=\s*([\d.]+)\s*A.*?'
        r'(?:typ|Typ)\s*\.?\s*([\d.]+)\s*V',
        re.IGNORECASE
    ),
    re.compile(
        r'V[Ff]\s*.*?@\s*25\s*°?C.*?([\d.]+)\s*V',
        re.IGNORECASE
    ),
    re.compile(
        r'V[Ff]\s*.*?@\s*(?:125|150|Tj\s*=\s*(?:125|150))\s*°?C.*?([\d.]+)\s*V',
        re.IGNORECASE
    ),
]

# ── SiC MOSFET Rds(on) ────────────────────────────────────────────────

RDS_ON_PATTERNS = [
    re.compile(
        r'R[Dd][Ss]\s*\(?\s*on\s*\)?\s*.*?@\s*25\s*°?C.*?'
        r'(?:typ|Typ)\s*\.?\s*([\d.]+)\s*m?Ω',
        re.IGNORECASE
    ),
    re.compile(
        r'R[Dd][Ss]\s*\(?\s*on\s*\)?\s*.*?@\s*(?:125|150|Tj\s*=\s*(?:125|150))\s*°?C.*?'
        r'(?:typ|Typ)\s*\.?\s*([\d.]+)\s*m?Ω',
        re.IGNORECASE
    ),
    re.compile(
        r'R[Dd][Ss]\s*\(?\s*on\s*\)?\s*.*?(?:typ|Typ)\s*\.?\s*([\d.]+)\s*m?Ω',
        re.IGNORECASE
    ),
]

# ── Thermal resistance ────────────────────────────────────────────────

RTH_JC_PATTERNS = [
    # Rth(j-c) IGBT
    re.compile(
        r'Rth?\s*\(\s*j\s*-\s*c\s*\).*?(?:IGBT|Transistor).*?'
        r'(?:typ|Typ|max|Max)\s*\.?\s*([\d.]+)\s*K?\s*/?\s*W',
        re.IGNORECASE
    ),
    # Rth(j-c) Diode
    re.compile(
        r'Rth?\s*\(\s*j\s*-\s*c\s*\).*?(?:Diode|FWD).*?'
        r'(?:typ|Typ|max|Max)\s*\.?\s*([\d.]+)\s*K?\s*/?\s*W',
        re.IGNORECASE
    ),
    # Generic Rth(j-c)
    re.compile(
        r'Rth?\s*\(\s*j\s*-\s*c\s*\).*?'
        r'(?:typ|Typ|max|Max)\s*\.?\s*([\d.]+)\s*K?\s*/?\s*W',
        re.IGNORECASE
    ),
]

RTH_CS_PATTERN = re.compile(
    r'Rth?\s*\(\s*c\s*-\s*s\s*\).*?'
    r'(?:typ|Typ)?\s*\.?\s*([\d.]+)\s*K?\s*/?\s*W',
    re.IGNORECASE
)

# Qrr - reverse recovery charge
QRR_PATTERN = re.compile(
    r'Qrr?\s*.*?(?:typ|Typ)\s*\.?\s*([\d.]+)\s*μ?C',
    re.IGNORECASE
)

# ── Package / module info ────────────────────────────────────────────

PART_NUMBER_PATTERN = re.compile(
    r'(?:Part\s*Number|Type\s*Name|Ordering\s*Code|Device)\s*[:=]?\s*'
    r'([A-Z]{2,5}[\dA-Z_\-]{5,30})',
    re.IGNORECASE
)

MANUFACTURER_PATTERNS = [
    re.compile(r'(Infineon|Mitsubishi|Fuji\s*Electric|Semikron|'
               r'ON\s*Semiconductor|STMicroelectronics|ST\s*Micro|'
               r'Rohm|Cree|Wolfspeed|ABB|Hitachi|Toshiba|'
               r'SanRex|Sanrex|Danfoss|Vincotech|Microsemi|Littelfuse)',
               re.IGNORECASE),
]


def extract_float(text: str, pattern: re.Pattern) -> Optional[float]:
    """Extract first float value matched by pattern."""
    match = pattern.search(text)
    if match:
        for group in match.groups():
            try:
                return float(group)
            except (ValueError, TypeError):
                continue
    return None


def extract_all_floats(text: str, pattern: re.Pattern) -> list[float]:
    """Extract all float values matched by pattern."""
    results = []
    for match in pattern.finditer(text):
        for group in match.groups():
            try:
                results.append(float(group))
            except (ValueError, TypeError):
                continue
    return results


def extract_with_confidence(text: str, patterns: list[re.Pattern]) -> tuple[Optional[float], float]:
    """
    Try multiple patterns, return (value, confidence).
    Confidence: 1.0 = single unambiguous match, < 1.0 = multiple matches or weak pattern.
    """
    best_value = None
    best_confidence = 0.0

    for i, pat in enumerate(patterns):
        matches = list(pat.finditer(text))
        if len(matches) == 1:
            val = None
            for group in matches[0].groups():
                try:
                    val = float(group)
                    break
                except (ValueError, TypeError):
                    continue
            if val is not None:
                conf = 0.9 if i < 3 else 0.7  # higher rank = higher confidence
                if conf > best_confidence:
                    best_value = val
                    best_confidence = conf
        elif len(matches) > 1:
            # Multiple matches - lower confidence
            vals = []
            for m in matches:
                for g in m.groups():
                    try:
                        vals.append(float(g))
                        break
                    except (ValueError, TypeError):
                        continue
            if vals:
                # Take the first value but with lower confidence
                conf = 0.5
                if conf > best_confidence:
                    best_value = vals[0]
                    best_confidence = conf

    return best_value, best_confidence
