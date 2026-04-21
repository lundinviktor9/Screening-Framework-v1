"""
Mapping-file loaders for the extractor normalizers.

Ported from Nordic `src/normalize/load_mappings.py`. The only change is
resolving the YAML path package-relative instead of CWD-relative, so the
extractor works regardless of where it's invoked from.
"""

from pathlib import Path
from typing import Any, Dict

import yaml

# extractor/config/mappings/*.yml — resolved relative to this file
_MAPPINGS_DIR = Path(__file__).resolve().parent.parent / "config" / "mappings"


def load_yaml(path: str | Path) -> Dict[str, Any]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Mapping file not found: {p.resolve()}")
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


def load_property_map() -> Dict[str, Any]:
    """Load the property type mapping YAML."""
    return load_yaml(_MAPPINGS_DIR / "property_type_map.yml")
