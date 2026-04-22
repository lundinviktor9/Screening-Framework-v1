from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")


"""
FastAPI server for deal pipeline extraction.

Exposes:
- POST /ingest — upload single or multiple PDFs
- POST /ingest-folder — batch extract from folder
- GET /deals — list all deals
- POST /deals/{deal_id}/market-override — override matched market
- DELETE /deals/{deal_id} — remove a deal
- GET /pdf/{deal_id} — retrieve original PDF

Chains Tasks 1-4: PDF read → extract → match → profile → persist
"""

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from datetime import datetime

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from extractor.pdf_reader import read_pdf
from extractor.extractor import extract_inbound_uk
from extractor.normalizer import normalize_inbound_uk_row
from extractor.market_matcher import MarketMatcher
from extractor.profile_generator import ProfileGenerator
from extractor.persistence import DealStore, create_deal_record, DealStore

# Initialize FastAPI
app = FastAPI(
    title="Deal Pipeline Extractor",
    description="Extract structured deal data from UK real estate IMs/teasers",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
REPO_ROOT = Path(__file__).parent.parent
MARKETS_CONFIG = REPO_ROOT / "scrapers" / "config" / "markets.json"
POSTCODE_MAP = Path(__file__).parent / "postcode_area_to_market.json"
STRATEGY_WEIGHTS = Path(__file__).parent / "strategy_weights.json"
DEALS_JSON = REPO_ROOT / "src" / "data" / "deals.json"
SCORED_MARKETS = REPO_ROOT / "public" / "data" / "scored_markets.json"

# Load pre-computed market scores
_scored_markets_by_id = {}
if SCORED_MARKETS.exists():
    with open(SCORED_MARKETS) as f:
        scored = json.load(f)
        _scored_markets_by_id = {m['id']: m for m in scored}

def get_pillar_scores(market_id: str) -> Dict[str, float]:
    """Retrieve pillar scores for a market from pre-computed file."""
    market = _scored_markets_by_id.get(market_id)
    return market['pillarScores'] if market else {}

matcher = MarketMatcher(str(MARKETS_CONFIG), str(POSTCODE_MAP))
generator = ProfileGenerator(str(STRATEGY_WEIGHTS))
store = DealStore(str(DEALS_JSON))

# PDF storage (for /pdf/{deal_id} endpoint)
PDFS_DIR = REPO_ROOT / "extractor" / "pdfs_ingested"
PDFS_DIR.mkdir(exist_ok=True)


class MarketOverride(BaseModel):
    """Request body for market override."""

    market_ids: List[str]


class IngestResponse(BaseModel):
    """Response from /ingest endpoint."""

    deal_id: str
    status: str
    source_filename: str
    extracted_fields: Optional[Dict[str, Any]]
    market_ids: List[str]
    market_match_confidence: float
    microlocation_fit_score: float
    microlocation_narrative: str
    extraction_errors: List[str] = []


def process_pdf(
    pdf_path: Path, force: bool = False
) -> tuple[Dict[str, Any], List[str]]:
    """
    Process a single PDF through the full pipeline.

    Returns:
        Tuple of (deal_record, errors)
        - deal_record: Complete DealRecord dict ready for persistence
        - errors: List of error messages (empty if successful)
    """
    errors = []

    try:
        # Read PDF
        pdf_bytes = pdf_path.read_bytes()
        pdf_hash = DealStore.hash_pdf_bytes(pdf_bytes)

        # Check idempotency (unless force=True)
        if not force:
            existing = store.find_by_pdf_hash(pdf_hash)
            if existing:
                return existing, []

        # Extract text
        text = read_pdf(str(pdf_path))
        if not text.strip():
            return None, ["No text extracted (image-only PDF?)"]

        # Extract structured fields
        extracted, meta = extract_inbound_uk(text)
        if not extracted:
            return None, ["Extraction returned empty result"]

        # Normalize fields
        normalized, norm_meta = normalize_inbound_uk_row(extracted, property_map={})

        # Match location to market(s)
        market_ids, match_confidence, match_method = matcher.match(
            normalized.get("Location"), normalized.get("Postal code")
        )

        # Generate profile (fit score + narrative)
        # Use pre-computed pillar scores from scored_markets.json
        # ProfileGenerator expects: {'uk-73': {'Supply': 75, 'Demand': 33.3, ...}, ...}
        pillar_scores = {}
        if market_ids:
            for market_id in market_ids:
                scores = get_pillar_scores(market_id)
                if scores:
                    pillar_scores[market_id] = scores

        profile = generator.generate(
            market_ids if market_ids else [],
            pillar_scores,
            deal_type=None,  # Could be inferred from normalized['Use']
        )

        # Create deal record
        deal_record = create_deal_record(
            normalized,
            market_ids,
            match_confidence,
            profile,
            pdf_hash,
            pdf_path.name,
        )

        # Store PDF for later retrieval via /pdf/{deal_id}
        pdf_copy = PDFS_DIR / f"{deal_record['deal_id']}.pdf"
        pdf_copy.write_bytes(pdf_bytes)

        return deal_record, errors

    except Exception as e:
        errors.append(f"Pipeline error: {str(e)}")
        return None, errors


@app.post("/ingest", response_model=List[IngestResponse])
async def ingest_pdfs(
    files: List[UploadFile] = File(...), force: bool = Query(False)
) -> List[IngestResponse]:
    """
    Upload and extract one or more PDFs.

    Args:
        files: PDF files to upload
        force: If True, re-extract even if PDF hash exists

    Returns:
        List of DealRecord responses with extraction results
    """
    results = []

    for file in files:
        try:
            # Write temp file
            temp_path = PDFS_DIR / f"temp_{file.filename}"
            content = await file.read()
            temp_path.write_bytes(content)

            # Process
            deal_record, errors = process_pdf(temp_path, force=force)

            if deal_record:
                # Persist
                saved_deal = store.add(deal_record)

                response = IngestResponse(
                    deal_id=saved_deal["deal_id"],
                    status=saved_deal["status"],
                    source_filename=saved_deal["source_filename"],
                    extracted_fields=saved_deal.get("extracted_fields"),
                    market_ids=saved_deal.get("market_ids", []),
                    market_match_confidence=saved_deal.get(
                        "market_match_confidence", 0.0
                    ),
                    microlocation_fit_score=saved_deal.get(
                        "microlocation_fit_score", 0
                    ),
                    microlocation_narrative=saved_deal.get(
                        "microlocation_narrative", ""
                    ),
                    extraction_errors=errors,
                )
            else:
                # Failed extraction
                response = IngestResponse(
                    deal_id="",
                    status="failed",
                    source_filename=file.filename,
                    extracted_fields=None,
                    market_ids=[],
                    market_match_confidence=0.0,
                    microlocation_fit_score=0,
                    microlocation_narrative="",
                    extraction_errors=errors,
                )

            results.append(response)

            # Clean up temp
            temp_path.unlink(missing_ok=True)

        except Exception as e:
            results.append(
                IngestResponse(
                    deal_id="",
                    status="failed",
                    source_filename=file.filename,
                    extracted_fields=None,
                    market_ids=[],
                    market_match_confidence=0.0,
                    microlocation_fit_score=0,
                    microlocation_narrative="",
                    extraction_errors=[str(e)],
                )
            )

    return results


@app.post("/ingest-folder", response_model=List[IngestResponse])
async def ingest_folder(folder_path: str = Query("deals_inbox")) -> List[IngestResponse]:
    """
    Batch extract all PDFs from a folder.

    Args:
        folder_path: Path to folder (relative to repo root)

    Returns:
        List of DealRecord responses
    """
    folder = PROJECT_ROOT / folder_path
    if not folder.exists():
        raise HTTPException(status_code=404, detail=f"Folder not found: {folder}")

    results = []
    pdf_files = list(folder.glob("*.pdf"))

    for pdf_file in pdf_files:
        deal_record, errors = process_pdf(pdf_file, force=False)

        if deal_record:
            saved_deal = store.add(deal_record)
            response = IngestResponse(
                deal_id=saved_deal["deal_id"],
                status=saved_deal["status"],
                source_filename=saved_deal["source_filename"],
                extracted_fields=saved_deal.get("extracted_fields"),
                market_ids=saved_deal.get("market_ids", []),
                market_match_confidence=saved_deal.get("market_match_confidence", 0.0),
                microlocation_fit_score=saved_deal.get("microlocation_fit_score", 0),
                microlocation_narrative=saved_deal.get("microlocation_narrative", ""),
                extraction_errors=errors,
            )
        else:
            response = IngestResponse(
                deal_id="",
                status="failed",
                source_filename=pdf_file.name,
                extracted_fields=None,
                market_ids=[],
                market_match_confidence=0.0,
                microlocation_fit_score=0,
                microlocation_narrative="",
                extraction_errors=errors,
            )

        results.append(response)

    return results


@app.get("/deals")
def list_deals() -> List[Dict[str, Any]]:
    """
    Get all deals.

    Returns:
        List of DealRecord dicts
    """
    return store.read_all()


@app.get("/deals/{deal_id}")
def get_deal(deal_id: str) -> Dict[str, Any]:
    """
    Get a single deal by ID.

    Returns:
        DealRecord dict
    """
    deal = store.read_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")
    return deal


@app.post("/deals/{deal_id}/market-override")
def override_market(deal_id: str, request: MarketOverride) -> Dict[str, Any]:
    """
    Override the matched market(s) for a deal.

    Args:
        deal_id: Deal ID
        request.market_ids: New market IDs to set

    Returns:
        Updated DealRecord
    """
    updated = store.update(deal_id, {"market_ids": request.market_ids})
    if not updated:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")
    return updated


@app.delete("/deals/{deal_id}")
def delete_deal(deal_id: str) -> Dict[str, str]:
    """
    Delete a deal record.

    Args:
        deal_id: Deal ID to delete

    Returns:
        Confirmation message
    """
    deleted = store.delete(deal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")

    # Also delete stored PDF
    pdf_file = PDFS_DIR / f"{deal_id}.pdf"
    pdf_file.unlink(missing_ok=True)

    return {"status": "deleted", "deal_id": deal_id}


@app.get("/pdf/{deal_id}")
def get_pdf(deal_id: str):
    """
    Retrieve the original PDF for a deal.

    Args:
        deal_id: Deal ID

    Returns:
        PDF file (for "Open PDF" button in UI)
    """
    deal = store.read_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal not found: {deal_id}")

    pdf_file = PDFS_DIR / f"{deal_id}.pdf"
    if not pdf_file.exists():
        raise HTTPException(status_code=404, detail=f"PDF not found for deal: {deal_id}")

    return FileResponse(
        pdf_file,
        filename=deal.get("source_filename", f"{deal_id}.pdf"),
        media_type="application/pdf",
    )


@app.get("/health")
def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "deal-pipeline-extractor"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8787, reload=True)
