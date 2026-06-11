"""
FastAPI routes for PPTX export — programmatic deck generation from deals.

Factory pattern: make_export_router(store) -> APIRouter
Routes: POST /export/deck
"""
import os
from datetime import datetime
from typing import List
from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel

from extractor.persistence import DealStore
from extractor.pptx_builder import build_deck


class ExportRequest(BaseModel):
    deal_ids: List[str]
    include_pipeline_summary: bool = False


def make_export_router(store: DealStore) -> APIRouter:
    router = APIRouter()

    @router.post("/export/deck")
    async def export_pptx(body: ExportRequest):
        """
        Build and download a PPTX deck from selected deals.

        Args:
            body.deal_ids: List of deal IDs to include
            body.include_pipeline_summary: Add a summary table slide

        Returns:
            PPTX file download
        """
        try:
            # Retrieve deals
            all_deals = store.read_all()
            selected_deals = [d for d in all_deals if d.get("deal_id") in body.deal_ids]

            if not selected_deals:
                return {"error": "No deals selected"}, 400

            # Get Mapbox token from env
            mapbox_token = os.environ.get("MAPBOX_TOKEN")

            # Build deck
            deck_bytes = build_deck(
                selected_deals,
                include_pipeline_summary=body.include_pipeline_summary,
                mapbox_token=mapbox_token,
            )

            # Generate filename with date
            now = datetime.utcnow()
            filename = f"Brunswick_Pipeline_{now.strftime('%Y%m%d_%H%M%S')}.pptx"

            return FileResponse(
                iter([deck_bytes]),
                media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                filename=filename,
            )

        except Exception as e:
            return {"error": str(e)}, 500

    return router
