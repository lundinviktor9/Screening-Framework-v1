"""
Property designation normalization: abbreviate repeated prefixes.

Swedish property designations often repeat the municipality/area prefix for each property.
This normalizer abbreviates the repeated prefixes for cleaner output.

Example:
- Input:  "Sigtuna Märsta 1:257, Sigtuna Märsta 1:259, Sigtuna Märsta 1:261"
- Output: "Sigtuna Märsta 1:257; 1:259; 1:261"
"""

import re
from typing import Tuple


def normalize_property_designation(raw_value: str) -> Tuple[str, str]:
    """
    Normalize property designations by abbreviating repeated prefixes.

    Args:
        raw_value: The raw property designation string

    Returns:
        Tuple of (normalized_value, confidence)
        - confidence: "high" if processed, "low" if empty/invalid
    """
    if not raw_value or not isinstance(raw_value, str):
        return ("", "low")

    raw_value = raw_value.strip()
    if not raw_value:
        return ("", "low")

    # Split by comma (and optionally "and" / "och")
    parts = re.split(r"\s*[,&]\s*|\s+(?:and|och)\s+", raw_value)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) <= 1:
        return (raw_value, "high")

    # Swedish property designation pattern: "Area Name X:XXX"
    # e.g., "Sigtuna Märsta 1:257"
    # The pattern is: text prefix followed by number:number
    designation_pattern = re.compile(r"^(.+?\s)(\d+:\d+.*)$")

    first_match = designation_pattern.match(parts[0])
    if not first_match:
        # Can't identify pattern, return as-is
        return (raw_value, "medium")

    prefix = first_match.group(1)  # e.g., "Sigtuna Märsta "
    result = [parts[0]]

    for part in parts[1:]:
        if part.startswith(prefix):
            # Abbreviate by removing the repeated prefix
            result.append(part[len(prefix):])
        else:
            # Different prefix, keep as-is
            result.append(part)

    return ("; ".join(result), "high")
