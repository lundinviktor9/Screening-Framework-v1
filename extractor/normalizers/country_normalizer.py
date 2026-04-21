"""
Country normalization: convert country name variations to canonical English names.

Handles:
- Native language names: Sverige, Danmark, Suomi
- Common abbreviations: SE, DK, FI
- Case variations
"""

from typing import Any, Tuple

# Canonical country names (must match schema allowed_values)
ALLOWED_COUNTRIES = {"Sweden", "Denmark", "Finland"}

# Synonym mappings (lowercase -> canonical)
COUNTRY_SYNONYMS = {
    # Sweden
    "sweden": "Sweden",
    "sverige": "Sweden",
    "se": "Sweden",
    "swe": "Sweden",
    "swedish": "Sweden",

    # Denmark
    "denmark": "Denmark",
    "danmark": "Denmark",
    "dk": "Denmark",
    "den": "Denmark",
    "danish": "Denmark",

    # Finland
    "finland": "Finland",
    "suomi": "Finland",
    "fi": "Finland",
    "fin": "Finland",
    "finnish": "Finland",
}


def normalize_country(raw_value: Any) -> Tuple[str, str]:
    """
    Normalize a country name to canonical form.

    Returns: (normalized_country, confidence)
    - confidence: "high" if matched, "low" if not
    - Returns ("", "low") if input is empty or unrecognized
    """
    if raw_value is None:
        return ("", "low")

    text = str(raw_value).strip()
    if not text:
        return ("", "low")

    # Check if already canonical
    if text in ALLOWED_COUNTRIES:
        return (text, "high")

    # Look up in synonyms
    canonical = COUNTRY_SYNONYMS.get(text.lower())
    if canonical:
        return (canonical, "high")

    # No match - return empty (don't guess)
    return ("", "low")
