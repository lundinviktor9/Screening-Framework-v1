"""
Date normalization: convert various date formats to yyyy/mm/dd.

Handles:
- ISO formats: 2024-01-15, 2024/01/15
- European formats: 15/01/2024, 15.01.2024, 15-01-2024
- Text formats: January 15, 2024 / 15 January 2024
- Swedish formats: 15 januari 2024
"""

import re
from typing import Any, Optional, Tuple

# Month name mappings (English + Swedish)
MONTH_MAP = {
    # English
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
    # Swedish
    "januari": 1,
    "februari": 2,
    "mars": 3,
    "maj": 5,
    "juni": 6,
    "juli": 7,
    "augusti": 8,
    "oktober": 10,
    # Danish (same as Swedish mostly, but adding explicit ones)
    "marts": 3,
    # Finnish
    "tammikuu": 1, "tammi": 1,
    "helmikuu": 2, "helmi": 2,
    "maaliskuu": 3, "maalis": 3,
    "huhtikuu": 4, "huhti": 4,
    "toukokuu": 5, "touko": 5,
    "kesäkuu": 6, "kesä": 6,
    "heinäkuu": 7, "heinä": 7,
    "elokuu": 8, "elo": 8,
    "syyskuu": 9, "syys": 9,
    "lokakuu": 10, "loka": 10,
    "marraskuu": 11, "marras": 11,
    "joulukuu": 12, "joulu": 12,
}


def normalize_date(raw_value: Any) -> Tuple[str, str]:
    """
    Normalize a date value to yyyy/mm/dd format.

    Returns: (normalized_date, confidence)
    - confidence: "high" if parsed successfully, "low" if failed
    - Returns ("", "low") if input is empty or unparseable
    """
    if raw_value is None:
        return ("", "low")

    text = str(raw_value).strip()
    if not text:
        return ("", "low")

    # Already in target format? yyyy/mm/dd
    match = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})$", text)
    if match:
        y, m, d = match.groups()
        if _is_valid_date(int(y), int(m), int(d)):
            return (f"{y}/{int(m):02d}/{int(d):02d}", "high")

    # ISO format: yyyy-mm-dd
    match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", text)
    if match:
        y, m, d = match.groups()
        if _is_valid_date(int(y), int(m), int(d)):
            return (f"{y}/{int(m):02d}/{int(d):02d}", "high")

    # European with slashes: dd/mm/yyyy
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", text)
    if match:
        d, m, y = match.groups()
        if _is_valid_date(int(y), int(m), int(d)):
            return (f"{y}/{int(m):02d}/{int(d):02d}", "high")

    # European with dots: dd.mm.yyyy
    match = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", text)
    if match:
        d, m, y = match.groups()
        if _is_valid_date(int(y), int(m), int(d)):
            return (f"{y}/{int(m):02d}/{int(d):02d}", "high")

    # European with dashes: dd-mm-yyyy
    match = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{4})$", text)
    if match:
        d, m, y = match.groups()
        if _is_valid_date(int(y), int(m), int(d)):
            return (f"{y}/{int(m):02d}/{int(d):02d}", "high")

    # Text format: "January 15, 2024" or "15 January 2024"
    parsed = _parse_text_date(text)
    if parsed:
        return (parsed, "high")

    # Could not parse - return empty with low confidence
    return ("", "low")


def _parse_text_date(text: str) -> Optional[str]:
    """Parse text-based dates like 'January 15, 2024' or '15 januari 2024'."""
    text_lower = text.lower()

    # Pattern: "Month day, year" or "Month day year"
    match = re.match(r"([a-zäöå]+)\s+(\d{1,2}),?\s+(\d{4})", text_lower)
    if match:
        month_str, day, year = match.groups()
        month = MONTH_MAP.get(month_str)
        if month and _is_valid_date(int(year), month, int(day)):
            return f"{year}/{month:02d}/{int(day):02d}"

    # Pattern: "day Month year"
    match = re.match(r"(\d{1,2})\s+([a-zäöå]+)\s+(\d{4})", text_lower)
    if match:
        day, month_str, year = match.groups()
        month = MONTH_MAP.get(month_str)
        if month and _is_valid_date(int(year), month, int(day)):
            return f"{year}/{month:02d}/{int(day):02d}"

    return None


def _is_valid_date(year: int, month: int, day: int) -> bool:
    """Basic date validation."""
    if year < 1900 or year > 2100:
        return False
    if month < 1 or month > 12:
        return False
    if day < 1 or day > 31:
        return False
    # Rough month-day validation
    if month in (4, 6, 9, 11) and day > 30:
        return False
    if month == 2 and day > 29:
        return False
    return True
