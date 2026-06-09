"""
extractor/underwrite_routes.py - FastAPI routes for the MLI underwrite stage (step 2).

Wires underwrite/adapter.py (Mode A/B) + underwrite/engine/normalisers/normalise_auto.py
into the existing pipeline server and stamps results onto the deal record via
DealStore.update(deal_id, {"underwrite": {...}}).

Flow (see underwrite/INTERFACE.md):
  upload rent roll
    -> normalise_auto: propose_mapping (LLM, layout only) + apply_mapping (code, real cells)
    -> run_mode_a: validate + surface judgement flags        [status: "flagged"]
  (analyst reviews mapping + 3 sample parsed rows, optionally corrects the column map)
    -> POST /confirm-mapping: re-run apply_mapping idempotently
  (analyst signs off mapping AND flags, sets assumptions)
    -> POST /run: run_mode_b -> headline returns + checks      [status: "underwritten"]

Rules honoured (INTERFACE.md s.5):
  - deal_id threads through every artifact.
  - Human-in-the-loop is MANDATORY: /run refuses unless the caller asserts the proposed
    column mapping AND the Mode A flags have been signed off.
  - No false precision: returns are persisted with their checks; `display_returns` is only
    true when checks.pass is true. If checks fail, status is "checks_failed".
  - Values come from cells, never from the LLM (normalise_auto's two-stage split).
  - Outputs are written OUTSIDE any OneDrive-synced folder (UNDERWRITE_OUT_DIR).

This module exposes a factory `make_underwrite_router(store)` so it shares the single
DealStore instance created in server.py (no duplicate store / deals.json path config).
"""
from __future__ import annotations

import os
import sys
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import openpyxl
from openpyxl.utils import column_index_from_string as cix

# Make the vendored engine importable (underwrite/ is a namespace package under the repo root).
REPO_ROOT = Path(__file__).parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from underwrite import adapter as uw                                  # noqa: E402
from underwrite.engine.normalisers import normalise_auto as na        # noqa: E402

# ---------------------------------------------------------------- config

RR_SHEET = "DealRR"
MAP_MODEL = os.environ.get("UNDERWRITE_MAP_MODEL", "claude-sonnet-4-6")

# Outputs MUST live outside OneDrive (sync dehydrates/corrupts xlsx mid-write). The repo lives
# under ...\Dokument (local), so this default is already safe; keep it explicit + overridable.
UNDERWRITE_DIR = Path(
    os.environ.get("UNDERWRITE_OUT_DIR", str(REPO_ROOT / "extractor" / "underwrite_runs"))
)
UNDERWRITE_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------- request bodies

class ConfirmMappingBody(BaseModel):
    """Analyst-corrected column map. Re-runs apply_mapping deterministically (no LLM)."""
    mapping: Dict[str, Any]
    asset: Optional[str] = None
    region: Optional[str] = None


class RunBody(BaseModel):
    """Confirmed assumptions + flag resolutions for Mode B."""
    assumptions: Dict[str, Any] = {}
    flag_resolutions: Optional[List[Dict[str, Any]]] = None
    # Human-in-the-loop gate: both must be true before Mode B is allowed to run.
    mapping_signed_off: bool = False
    flags_signed_off: bool = False
    asset: Optional[str] = None
    region: Optional[str] = None


# ---------------------------------------------------------------- helpers

def _deal_or_404(store, deal_id: str) -> Dict[str, Any]:
    deal = store.read_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")
    return deal


def _defaults(deal: Dict[str, Any]) -> Dict[str, str]:
    """asset/region defaults from the existing extracted fields."""
    ef = deal.get("extracted_fields") or {}
    asset = ef.get("Project Name") or ef.get("Address") or deal.get("source_filename") or deal["deal_id"]
    region = ef.get("Location") or (deal.get("market_ids") or [""])[0] or "UK"
    return {"asset": str(asset), "region": str(region)}


def _merge_underwrite(store, deal_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    """Read-merge-write the `underwrite` sub-object (DealStore.update is a shallow dict.update,
    so we must merge by hand or we'd clobber prior underwrite state)."""
    deal = _deal_or_404(store, deal_id)
    block = dict(deal.get("underwrite") or {})
    block.update(patch)
    block["updated_at"] = datetime.utcnow().isoformat() + "Z"
    store.update(deal_id, {"underwrite": block})
    return block


def _deal_dir(deal_id: str) -> Path:
    d = UNDERWRITE_DIR / deal_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _sample_rows(rr_xlsx: str, rr_sheet: str = RR_SHEET, n: int = 3) -> List[Dict[str, Any]]:
    """First n parsed data rows from the canonical RR, for the analyst review step.
    Returns header -> value with nulls dropped so the grid is readable."""
    wb = openpyxl.load_workbook(rr_xlsx, data_only=True)
    if rr_sheet not in wb.sheetnames:
        return []
    ws = wb[rr_sheet]
    headers = {c: (ws.cell(1, c).value or "") for c in range(1, ws.max_column + 1)}
    out: List[Dict[str, Any]] = []
    for r in range(2, min(ws.max_row, 1 + n) + 1):
        # Unit Number lives in column E in the canonical layout; stop at the first blank.
        if ws.cell(r, cix("E")).value in (None, ""):
            break
        row = {headers[c]: ws.cell(r, c).value for c in range(1, ws.max_column + 1)
               if headers[c] and ws.cell(r, c).value not in (None, "")}
        out.append(row)
    return out


def _normalise(raw_path: str, asset: str, region: str, out_xlsx: str,
               mapping: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Stage 1 (LLM, only when mapping is None) + Stage 2 (deterministic) -> canonical RR."""
    client = None
    if mapping is None:
        try:
            import anthropic  # type: ignore
            client = anthropic.Anthropic()
        except Exception as e:  # pragma: no cover - surfaced to caller
            raise HTTPException(status_code=500,
                                detail=f"Anthropic client init failed (ANTHROPIC_API_KEY?): {e}")
    try:
        return na.normalise_auto(raw_path, asset, region, out_xlsx,
                                 rr_sheet=RR_SHEET, mapping=mapping, anthropic_client=client)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Normalisation failed: {e}")


# ---------------------------------------------------------------- router factory

def make_underwrite_router(store) -> APIRouter:
    router = APIRouter(prefix="/underwrite", tags=["underwrite"])

    @router.post("/{deal_id}")
    async def underwrite_upload(
        deal_id: str,
        file: UploadFile = File(...),
        asset: Optional[str] = Form(None),
        region: Optional[str] = Form(None),
    ) -> Dict[str, Any]:
        """Upload a broker rent roll -> propose mapping (LLM) -> apply mapping (code) ->
        Mode A flags. Persists underwrite={status:"flagged",...}. Returns the proposed
        mapping + 3 sample parsed rows + flags for analyst review (NOT auto-advanced)."""
        deal = _deal_or_404(store, deal_id)
        d = _defaults(deal)
        asset = asset or d["asset"]
        region = region or d["region"]

        ddir = _deal_dir(deal_id)
        raw_path = ddir / f"raw_{file.filename}"
        raw_path.write_bytes(await file.read())

        rr_xlsx = str(ddir / "canonical_rr.xlsx")
        norm = _normalise(str(raw_path), asset, region, rr_xlsx, mapping=None)
        mode_a = uw.run_mode_a(deal_id, rr_xlsx, RR_SHEET)

        block = _merge_underwrite(store, deal_id, {
            "status": "flagged",
            "asset": asset,
            "region": region,
            "raw_path": str(raw_path),
            "rr_xlsx": rr_xlsx,
            "rr_sheet": RR_SHEET,
            "mapping": norm["mapping"],
            "mapping_confirmed": False,
            "normalise_flags": norm["flags"],
            "mode_a_flags": mode_a["flags"],
            "schema_errors": mode_a["schema_errors"],
            "units": mode_a["units"],
            # Returns are explicitly absent until Mode B; UI must not show stale numbers.
            "returns": None,
            "checks": None,
        })
        return {
            "deal_id": deal_id,
            "status": block["status"],
            "asset": asset,
            "region": region,
            "units": block["units"],
            "mapping": block["mapping"],
            "sample_rows": _sample_rows(rr_xlsx),
            "normalise_flags": block["normalise_flags"],
            "mode_a_flags": block["mode_a_flags"],
            "schema_errors": block["schema_errors"],
        }

    @router.post("/{deal_id}/confirm-mapping")
    def underwrite_confirm_mapping(deal_id: str, body: ConfirmMappingBody) -> Dict[str, Any]:
        """Analyst-corrected column map -> re-run apply_mapping (deterministic, idempotent).
        Re-derives the canonical RR + Mode A flags from the SAME raw upload."""
        deal = _deal_or_404(store, deal_id)
        block = deal.get("underwrite") or {}
        raw_path = block.get("raw_path")
        if not raw_path or not Path(raw_path).exists():
            raise HTTPException(status_code=409,
                                detail="No uploaded rent roll for this deal; POST /underwrite/{deal_id} first.")
        asset = body.asset or block.get("asset") or _defaults(deal)["asset"]
        region = body.region or block.get("region") or _defaults(deal)["region"]

        rr_xlsx = block.get("rr_xlsx") or str(_deal_dir(deal_id) / "canonical_rr.xlsx")
        norm = _normalise(raw_path, asset, region, rr_xlsx, mapping=body.mapping)
        mode_a = uw.run_mode_a(deal_id, rr_xlsx, RR_SHEET)

        updated = _merge_underwrite(store, deal_id, {
            "status": "flagged",
            "asset": asset,
            "region": region,
            "rr_xlsx": rr_xlsx,
            "mapping": body.mapping,
            "mapping_confirmed": True,
            "normalise_flags": norm["flags"],
            "mode_a_flags": mode_a["flags"],
            "schema_errors": mode_a["schema_errors"],
            "units": mode_a["units"],
        })
        return {
            "deal_id": deal_id,
            "status": updated["status"],
            "mapping_confirmed": True,
            "units": updated["units"],
            "mapping": updated["mapping"],
            "sample_rows": _sample_rows(rr_xlsx),
            "normalise_flags": updated["normalise_flags"],
            "mode_a_flags": updated["mode_a_flags"],
            "schema_errors": updated["schema_errors"],
        }

    @router.post("/{deal_id}/run")
    def underwrite_run(deal_id: str, body: RunBody) -> Dict[str, Any]:
        """Mode B: inject the confirmed RR + assumption dials, headless recalc, verify, return
        headline metrics. Refuses unless the mapping AND the Mode A flags are signed off."""
        deal = _deal_or_404(store, deal_id)
        block = deal.get("underwrite") or {}
        if block.get("status") not in ("flagged", "checks_failed", "underwritten"):
            raise HTTPException(status_code=409,
                                detail="Run Mode A first (POST /underwrite/{deal_id}).")
        if not (body.mapping_signed_off and body.flags_signed_off):
            raise HTTPException(status_code=409, detail=(
                "Human-in-the-loop required: set mapping_signed_off and flags_signed_off "
                "to true once the column map and Mode A flags have been reviewed."))

        rr_xlsx = block.get("rr_xlsx")
        if not rr_xlsx or not Path(rr_xlsx).exists():
            raise HTTPException(status_code=409, detail="Canonical RR missing; re-upload the rent roll.")

        assumptions = dict(body.assumptions or {})
        entry = assumptions.get("entry_date")
        if not entry:
            raise HTTPException(status_code=422, detail="assumptions.entry_date (YYYY-MM-DD) is required.")

        asset = body.asset or block.get("asset") or _defaults(deal)["asset"]
        region = body.region or block.get("region") or _defaults(deal)["region"]

        run_dir = _deal_dir(deal_id) / f"run_{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}"
        try:
            result = uw.run_mode_b(
                deal_id, rr_xlsx, RR_SHEET, asset, region, entry,
                assumptions=assumptions, workdir=str(run_dir),
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Mode B failed: {e}")

        # Persist the recalced model at a stable path for GET /model.
        model_dest = _deal_dir(deal_id) / "model.xlsx"
        try:
            shutil.copyfile(result["model_xlsx"], model_dest)
        except Exception:
            model_dest = Path(result["model_xlsx"])  # fall back to the in-place run output

        checks = result["checks"]
        passed = bool(checks.get("pass"))
        block_patch = {
            "status": "underwritten" if passed else "checks_failed",
            "assumptions": assumptions,
            "flag_resolutions": body.flag_resolutions or [],
            "returns": result["returns"],
            "checks": checks,
            "assumption_notes": result.get("assumption_notes", []),
            "model_xlsx": str(model_dest),
            "display_returns": passed,   # no false precision: only display when checks pass
        }
        updated = _merge_underwrite(store, deal_id, block_patch)
        return {
            "deal_id": deal_id,
            "status": updated["status"],
            "display_returns": passed,
            "returns": result["returns"],
            "checks": checks,
            "assumption_notes": result.get("assumption_notes", []),
            "model_url": f"/underwrite/{deal_id}/model",
        }

    @router.get("/{deal_id}")
    def underwrite_get(deal_id: str) -> Dict[str, Any]:
        """The current underwrite block for a deal."""
        deal = _deal_or_404(store, deal_id)
        block = deal.get("underwrite")
        if not block:
            raise HTTPException(status_code=404, detail=f"No underwrite for deal: {deal_id}")
        return block

    @router.get("/{deal_id}/model")
    def underwrite_model(deal_id: str):
        """Download the populated, editable .xlsx model."""
        deal = _deal_or_404(store, deal_id)
        block = deal.get("underwrite") or {}
        path = block.get("model_xlsx")
        if not path or not Path(path).exists():
            raise HTTPException(status_code=404, detail="No model for this deal yet; run Mode B first.")
        asset = (block.get("asset") or deal_id).replace(" ", "_")
        return FileResponse(
            path,
            filename=f"{asset}_underwrite.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    return router
