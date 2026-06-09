"""
normalise_auto.py - layout-agnostic rent-roll normaliser (hybrid LLM-map + deterministic-extract).

ANY broker tenancy schedule -> the canonical field-dictionary layout that the underwrite engine
consumes. Two stages, deliberately separated so financial values are NEVER produced by an LLM:

  Stage 1 (LLM, fuzzy):  propose_mapping(sheet_preview) -> a MAPPING (which sheet, header row,
                         data range, {canonical field -> source column}, derivations, flags).
                         The LLM reads HEADERS + a few sample rows and reasons about layout only.
  Stage 2 (code, exact): apply_mapping(ws, mapping) reads the ACTUAL cells via the mapping and
                         parses them deterministically (dates, money, %, psf<->pa), applies the
                         house derivations, validates vs tenancy_schedule.schema.json, and writes
                         the canonical RR sheet. Numbers come straight from cells.

Judgment fields (entry/exit yield = pricing; area reconciliation; vacate-at-expiry house view)
are NOT auto-resolved here - they are emitted as flags for analyst sign-off (Mode A).
"""
from __future__ import annotations
import datetime as _dt
import re
from typing import Any, Dict, List, Optional

import openpyxl
from openpyxl.utils import column_index_from_string as cix, get_column_letter as gl

# ----- deterministic parsers (the trustworthy half) -----

def parse_num(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^0-9.\-]", "", str(v).replace(",", ""))
    return float(s) if s not in ("", "-", ".") else None

def parse_pct(v: Any) -> Optional[float]:
    """'7.0%'/7.0 -> 0.07 ; 0.07 -> 0.07."""
    n = parse_num(v)
    if n is None:
        return None
    if isinstance(v, str) and "%" in v:
        return n / 100.0
    return n / 100.0 if n > 1.0 else n   # 7.25 -> 0.0725 ; 0.0725 -> 0.0725

def parse_date(v: Any) -> Optional[_dt.datetime]:
    if v is None or v == "":
        return None
    if isinstance(v, _dt.datetime):
        return _dt.datetime(v.year, v.month, v.day)
    if isinstance(v, _dt.date):
        return _dt.datetime(v.year, v.month, v.day)
    try:
        from dateutil import parser as _p          # type: ignore
        return _p.parse(str(v), dayfirst=True).replace(hour=0, minute=0, second=0, microsecond=0)
    except Exception:
        return None

def parse_yn(v: Any) -> str:
    s = str(v or "").strip().lower()
    return "Y" if s in ("y", "yes", "1", "true", "vacant") else "N"

# ----- mapping-driven extraction (Stage 2) -----

# canonical fields the engine RR needs (field-dictionary letters in the RR sheet)
RR_COLS = {  # canonical name -> RR output column letter
    "Asset Name": "B", "Region": "C", "Sector": "D", "Unit Number": "E", "Tenant Name": "F",
    "Area GIA (sq ft)": "G", "Entry Yield (NIY)": "H", "Exit Yield": "I", "Lease Start": "J",
    "Lease Expiry": "K", "Break Date": "L", "Break Taken (1=Yes,0=No)": "M",
    "Rent Review / MTM Date": "N", "Event @ Expiry (Y=Renew / X=Vacate)": "O",
    "Vacant @ Entry (Y/N)": "P", "Passing Rent (pa)": "S", "ERV (pa)": "T", "ERV (psf)": "U",
    "Assumed Void (mths)": "Y", "Assumed Rent Free (mths)": "Z", "Re-letting Capex (psf)": "AA",
    "Guarantee Rent (pa)": "BF",
}
NUM = {"Area GIA (sq ft)", "Passing Rent (pa)", "ERV (pa)", "ERV (psf)", "Assumed Void (mths)",
       "Assumed Rent Free (mths)", "Re-letting Capex (psf)", "Guarantee Rent (pa)"}
PCT = {"Entry Yield (NIY)", "Exit Yield"}
DATE = {"Lease Start", "Lease Expiry", "Break Date", "Rent Review / MTM Date"}
YN = {"Vacant @ Entry (Y/N)"}


def apply_mapping(ws, mapping: Dict[str, Any], asset: str, region: str) -> Dict[str, Any]:
    """Read cells via the mapping, parse + derive deterministically, return canonical rows + flags."""
    colmap: Dict[str, str] = mapping["columns"]            # canonical field -> source col letter
    aux: Dict[str, str] = mapping.get("aux_columns", {})   # extra source cols used by derivations
    hdr = int(mapping["data_start_row"])
    unit_src = colmap["Unit Number"]
    rows: List[Dict[str, Any]] = []
    flags: List[Dict[str, Any]] = []

    def cell(r, field_or_letter):
        col = colmap.get(field_or_letter) or aux.get(field_or_letter)
        return ws.cell(r, cix(col)).value if col else None

    r = hdr
    while ws.cell(r, cix(unit_src)).value not in (None, ""):
        row: Dict[str, Any] = {"Asset Name": asset, "Region": region, "Sector": "Industrial"}
        for field, col in colmap.items():
            raw = ws.cell(r, cix(col)).value
            if field in PCT:
                row[field] = parse_pct(raw)
            elif field in NUM:
                row[field] = parse_num(raw)
            elif field in DATE:
                row[field] = parse_date(raw)
            elif field in YN:
                row[field] = parse_yn(raw)
            else:
                row[field] = raw
        # ----- house derivations (deterministic) -----
        # ERV pa from psf * area when pa absent
        if not row.get("ERV (pa)") and row.get("ERV (psf)") and row.get("Area GIA (sq ft)"):
            row["ERV (pa)"] = round(row["ERV (psf)"] * row["Area GIA (sq ft)"], 2)
        # vacant @ entry: explicit flag, else tenant 'Vacant' / passing 0
        if "Vacant @ Entry (Y/N)" not in colmap:
            t = str(row.get("Tenant Name") or "").lower()
            row["Vacant @ Entry (Y/N)"] = "Y" if (t == "vacant" or not row.get("Passing Rent (pa)")) else "N"
        # event @ expiry: X (vacate) if break taken OR vacate-at-expiry flag, else Y (renew)
        bt = str(cell(r, "Break Taken (1=Yes,0=No)") or "").strip() in ("1", "1.0")
        vac_exp = str(cell(r, "_vacate_at_expiry") or "").strip() in ("1", "1.0", "y", "yes")
        row["Event @ Expiry (Y=Renew / X=Vacate)"] = "X" if (bt or vac_exp) else "Y"
        # guarantee rent: only meaningful for vacant@entry units
        if row.get("Vacant @ Entry (Y/N)") != "Y":
            row["Guarantee Rent (pa)"] = None
        rows.append(row)
        r += 1

    # ----- judgment flags (NOT auto-resolved) -----
    flags.append({"field": "Entry Yield (NIY)", "note": "schedule NIY is a starting point; confirm "
                  "the acquisition yield (pricing decision)", "needs_signoff": True})
    flags.append({"field": "Exit Yield", "note": "confirm exit yield (biggest value driver)",
                  "needs_signoff": True})
    for row in rows:
        if row.get("Vacant @ Entry (Y/N)") == "Y":
            flags.append({"unit": row["Unit Number"], "field": "Vacant @ Entry",
                          "note": "confirm vacant valuation basis (capitalise guarantee/headline)",
                          "needs_signoff": True})
    return {"rows": rows, "flags": flags, "units": len(rows)}


def write_rr_sheet(rows: List[Dict[str, Any]], out_xlsx: str, rr_sheet: str = "DealRR") -> None:
    """Write canonical rows to an xlsx RR sheet in the field-dictionary layout (row 1 = headers)."""
    wb = openpyxl.Workbook()
    ws = wb.active; ws.title = rr_sheet
    ws["A1"] = "#"
    for field, col in RR_COLS.items():
        ws[f"{col}1"] = field
    for i, row in enumerate(rows):
        rr = 2 + i
        ws.cell(rr, 1, i + 1)
        for field, col in RR_COLS.items():
            v = row.get(field)
            if v is not None:
                ws.cell(rr, cix(col), v)
    wb.save(out_xlsx)


# ----- Stage 1: LLM column mapping (run in the app, with the Anthropic API) -----

def sheet_preview(ws, n_rows: int = 8, n_cols: int = 30) -> str:
    """A compact grid the LLM can reason over: column letters + the first n_rows rows."""
    lines = []
    for r in range(1, n_rows + 1):
        cells = [f"{gl(c)}={ws.cell(r, c).value!r}" for c in range(1, n_cols + 1)
                 if ws.cell(r, c).value not in (None, "")]
        if cells:
            lines.append(f"row{r}: " + " | ".join(cells))
    return "\n".join(lines)

MAPPING_PROMPT = """You map a broker rent roll to a canonical schema. Output STRICT JSON only.

Canonical fields (map each to the source COLUMN LETTER that holds it; omit if not present):
  Unit Number, Tenant Name, Area GIA (sq ft), Entry Yield (NIY), Exit Yield, Lease Start,
  Lease Expiry, Break Date, Break Taken (1=Yes,0=No), Rent Review / MTM Date,
  Vacant @ Entry (Y/N), Passing Rent (pa), Guarantee Rent (pa) [= headline rent for vacant units],
  ERV (pa), ERV (psf), Assumed Void (mths), Assumed Rent Free (mths), Re-letting Capex (psf)

Also return aux_columns for any "Vacate at Expiry" flag as key "_vacate_at_expiry".

Rules: do NOT read or transcribe any numeric/date VALUES - only identify which column letter holds
each field. Identify the header row and the first data row. Flag anything ambiguous.

Schedule preview (column letters + first rows):
{preview}

Return JSON: {{"sheet": "<name>", "header_row": <int>, "data_start_row": <int>,
"columns": {{"<canonical field>": "<col letter>", ...}}, "aux_columns": {{...}},
"flags": [{{"field": "...", "note": "..."}}]}}"""

def propose_mapping(ws, sheet_name: str, anthropic_client=None, model: str = "claude-sonnet-4-6") -> Dict[str, Any]:
    """Ask the LLM for the column mapping. Requires an Anthropic client (app supplies it)."""
    import json
    prompt = MAPPING_PROMPT.format(preview=sheet_preview(ws))
    if anthropic_client is None:
        import anthropic  # type: ignore
        anthropic_client = anthropic.Anthropic()
    msg = anthropic_client.messages.create(
        model=model, max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text
    text = text[text.find("{"): text.rfind("}") + 1]
    m = json.loads(text)
    m.setdefault("sheet", sheet_name)
    return m


def normalise_auto(file_path: str, asset: str, region: str, out_xlsx: str,
                   rr_sheet: str = "DealRR", mapping: Optional[Dict[str, Any]] = None,
                   anthropic_client=None) -> Dict[str, Any]:
    """End-to-end: (LLM) propose mapping -> (code) extract + derive + write canonical RR.
    Pass `mapping` explicitly to skip the LLM (e.g. a confirmed/known-layout map)."""
    wb = openpyxl.load_workbook(file_path, data_only=True)
    if mapping is None:
        ws = wb[wb.sheetnames[0]]
        mapping = propose_mapping(ws, ws.title, anthropic_client)
    ws = wb[mapping.get("sheet", wb.sheetnames[0])]
    res = apply_mapping(ws, mapping, asset, region)
    write_rr_sheet(res["rows"], out_xlsx, rr_sheet)
    return {"rr_xlsx": out_xlsx, "rr_sheet": rr_sheet, "units": res["units"],
            "flags": res["flags"], "mapping": mapping}
