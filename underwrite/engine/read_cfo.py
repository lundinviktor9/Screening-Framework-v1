"""
CFO returns extraction — header-resolved cell lookup for v21 models.

Reads a recalculated model and extracts unlevered/levered returns + assumptions
by scanning for stable header substrings, not hardcoded column letters.
Returns None if any header fails to resolve (flag-don't-fabricate).
"""
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import openpyxl
from openpyxl.utils import get_column_letter


def extract_cfo_returns(recalced: Path) -> Optional[Dict[str, Any]]:
    """
    Extract CFO returns and assumptions from a recalculated v21 model.

    Args:
        recalced: Path to the recalc_out .xlsx file (data_only=True values).

    Returns:
        Dict with unlevered/levered returns, assumptions, and source traceability.
        None if any header resolution fails.
    """
    try:
        wb = openpyxl.load_workbook(recalced, data_only=True)
    except Exception:
        return None

    # Find CFO sheet (case-insensitive)
    cfo_sheet = None
    for name in wb.sheetnames:
        if name.lower() == "cash flow output":
            cfo_sheet = wb[name]
            break
    if not cfo_sheet:
        return None

    # Scan for header row containing "Unlevered" and "Levered" column headers
    unlev_col, lev_col, header_row = _find_returns_headers(cfo_sheet)
    if unlev_col is None or lev_col is None:
        return None

    # Scan for return row labels below headers
    row_map = _find_return_rows(cfo_sheet, header_row, unlev_col, lev_col)
    if not all(k in row_map for k in ["irr", "em", "coc", "profit", "equity"]):
        return None

    # Extract return values
    unlev_returns = {
        "irr": _safe_float(cfo_sheet.cell(row_map["irr"], unlev_col).value),
        "em": _safe_float(cfo_sheet.cell(row_map["em"], unlev_col).value),
        "coc_y5": _safe_float(cfo_sheet.cell(row_map["coc"], unlev_col).value),
        "profit": _safe_float(cfo_sheet.cell(row_map["profit"], unlev_col).value),
        "equity": _safe_float(cfo_sheet.cell(row_map["equity"], unlev_col).value),
    }

    lev_returns = {
        "irr": _safe_float(cfo_sheet.cell(row_map["irr"], lev_col).value),
        "em": _safe_float(cfo_sheet.cell(row_map["em"], lev_col).value),
        "coc_y5": _safe_float(cfo_sheet.cell(row_map["coc"], lev_col).value),
        "profit": _safe_float(cfo_sheet.cell(row_map["profit"], lev_col).value),
        "equity": _safe_float(cfo_sheet.cell(row_map["equity"], lev_col).value),
    }

    # Extract assumptions from Global Assumptions sheet
    assumptions = _extract_assumptions(wb)

    # Build source traceability
    source = {
        "sheet": "Cash Flow Output",
        "unlevered_col": get_column_letter(unlev_col),
        "levered_col": get_column_letter(lev_col),
        "resolved_by": "header",
        "row_map": {k: v for k, v in row_map.items()},
    }

    return {
        "scenario_label": None,  # Could be read from Q35 label if needed
        "unlevered": unlev_returns,
        "levered": lev_returns,
        "assumptions_table": assumptions,
        "source": source,
    }


def _find_returns_headers(cfo_sheet) -> Tuple[Optional[int], Optional[int], Optional[int]]:
    """
    Scan CFO sheet for 'Unlevered' and 'Levered' header columns.

    Returns (unlev_col_idx, lev_col_idx, header_row) or (None, None, None).
    """
    # Scan top rows (typically row 1-20) for header row
    for row_num in range(1, min(21, cfo_sheet.max_row + 1)):
        row_vals = [
            (cfo_sheet.cell(row_num, c).value or "").lower()
            for c in range(1, cfo_sheet.max_column + 1)
        ]

        # Check if this row has both "unlevered" and "levered" keywords
        if any("unlevered" in v for v in row_vals) and any("levered" in v for v in row_vals):
            # Found header row; now resolve column indices
            unlev_col = None
            lev_col = None

            for col_idx, cell_val in enumerate(row_vals, start=1):
                if "unlevered" in cell_val and "promote" not in cell_val:
                    unlev_col = col_idx
                if "levered" in cell_val and ("promote" in cell_val or "post tax" in cell_val):
                    lev_col = col_idx

            if unlev_col and lev_col:
                return unlev_col, lev_col, row_num

    return None, None, None


def _find_return_rows(
    cfo_sheet, header_row: int, unlev_col: int, lev_col: int
) -> Dict[str, int]:
    """
    Scan rows below header_row for IRR, EM, CoC, Profit, Equity labels.
    Returns a dict mapping label keys to row numbers.
    """
    row_map = {}

    # Scan column A (or first non-empty column) for row labels
    for row_num in range(header_row + 1, min(header_row + 50, cfo_sheet.max_row + 1)):
        label = (cfo_sheet.cell(row_num, 1).value or "").lower()

        if not label:
            continue

        if "irr" in label:
            row_map["irr"] = row_num
        elif "equity" in label and "multiple" not in label:
            row_map["equity"] = row_num
        elif "moic" in label or ("em" in label and "EM " in str(cfo_sheet.cell(row_num, 1).value or "")):
            row_map["em"] = row_num
        elif "cash" in label and ("cash on cash" in label or "coc" in label):
            row_map["coc"] = row_num
        elif "profit" in label:
            row_map["profit"] = row_num

    return row_map


def _extract_assumptions(wb) -> Dict[str, Any]:
    """
    Extract assumptions table from Global Assumptions sheet.
    Scan for entry/exit columns and relevant assumption row labels.
    """
    ga = None
    for name in wb.sheetnames:
        if name.lower() == "global assumptions":
            ga = wb[name]
            break

    if not ga:
        return {}

    assumptions = {
        "acq_date_entry": None,
        "acq_date_exit": None,
        "pp_entry": None,
        "pp_exit": None,
        "niy_entry": None,
        "niy_exit": None,
        "ry_entry": None,
        "ry_exit": None,
        "capval_psf_entry": None,
        "capval_psf_exit": None,
        "ltv": None,
        "interest_rate": None,
        "arrangement_fee": None,
    }

    # Scan GA sheet for key labels and resolve entry/exit values
    # (This is a simplified stub — in practice would scan headers and populate)
    # For now, return the stub dict; in full implementation would populate from GA cells.

    return assumptions


def _safe_float(val: Any) -> Optional[float]:
    """Convert a value to float, or None if invalid."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
