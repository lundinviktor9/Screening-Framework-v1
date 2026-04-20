# TASKS — Brunswick Screening Framework

## Last Updated
19 April 2026

## Current Status
Application is fully functional with 8 pages, a Zustand store, and an 
automated data pipeline producing verified government data for 10 metrics 
across all 76 markets. Scoring logic correctly excludes null metrics.
The remaining gap is frontend validation and commercial data entry.

---

## Completed

### React Application
- [x] Rankings page — table, pillar scores, RAG, completeness badges, "Last Updated" from master_data.json
- [x] Map page — Leaflet CircleMarkers colour-coded by tier, profile panel
- [x] Sensitivity page — 6 pillar weight sliders with live re-ranking
- [x] Dashboard page — radar chart, pillar bars, 60-metric heatmap, multi-market compare
- [x] Data Entry page — market selector, pillar accordions, per-metric form (value, source, date, geo-level, confidence), regional proxy cascade
- [x] Data Sources page — all 60 metrics with clickable source links, status badges, coverage bars per metric
- [x] Add Market / Edit Market (MarketForm with live score preview)
- [x] Export CSV / Import CSV
- [x] Reset to Defaults

### State Management
- [x] Zustand store (src/store/marketStore.ts) — shared across all pages
- [x] master_data.json auto-loaded on app init, merged respecting source priority
- [x] Legacy data migration (assigns VERIFIED/ESTIMATED status to pre-filled sources)
- [x] REVIEW_NEEDED values excluded from scoring via getScorableMarkets()

### Scoring Logic
- [x] Null metrics excluded from pillar average (only average metrics with data)
- [x] Empty pillars excluded from weighted total (weight redistributed to pillars with data)
- [x] Pillar cells show scored/total count (e.g. "3/10")
- [x] MarketForm live preview uses same null-excluding logic
- [x] Sensitivity reScore uses same null-excluding logic

### Data Pipeline (Python Scrapers)
- [x] nomis_scraper.py — M33 (pop growth), M35 (working-age share), M36 (claimant rate), M40 (logistics/mfg share). 303/380 values. M37 unavailable from API.
- [x] overpass_scraper.py — M22 (motorway), M23 (rail freight), M24 (port), M25 (airport). 304/304 values. Checkpoint/resume support.
- [x] environment_agency_scraper.py — M58 (flood risk) England/Wales. 70/76 values.
- [x] sepa_flood_scraper.py — M58 for Scotland. 6/6 values.
- [x] data_merger.py — combines all outputs, validates bounds, writes public/data/master_data.json

### Data Coverage (in master_data.json)
- M22: 76/76 (motorway junction distance)
- M23: 76/76 (rail freight terminal distance)
- M24: 76/76 (port distance)
- M25: 76/76 (cargo airport distance)
- M33: 76/76 (population growth 10yr)
- M35: 76/76 (working-age share)
- M36: 76/76 (unemployment/claimant rate)
- M37: 0/76  (economic activity — NOMIS dataset currently unavailable)
- M40: 75/76 (logistics/manufacturing workforce share)
- M58: 76/76 (flood risk)
- Total: 683 verified values across 76 markets (avg 9.0 per market)

### Config & Documentation
- [x] CLAUDE.md — full architecture briefing
- [x] scrapers/README.md — run instructions for all scrapers
- [x] scrapers/config/markets.json — 76 markets with LA codes, centroids, regions

---

## Not Yet Built

### Frontend Validation (Step 2 from original plan)
- [ ] src/config/metricValidation.ts — min/max bounds for all 60 metrics
- [ ] src/utils/validation.ts — validateMetricValue() function
- [ ] Data Entry panel: inline warnings for out-of-range values
- [ ] Auto-flag REVIEW_NEEDED on out-of-range entry
- [ ] "Override" button with justification note for REVIEW_NEEDED values

### pdf_scraper.py (Step 8)
- [ ] pdfplumber text extraction from broker PDFs
- [ ] NuExtract (HuggingFace free tier) for structured value extraction
- [ ] Blocked on: team placing broker PDFs in /scrapers/pdfs/

---

## Known Issues

1. **M37 (Economic activity rate)**: NM_17_5 dataset returns 0 results 
   from NOMIS API. May be temporary or require different query parameters.
   All 76 markets show null for this metric.

2. **Pre-filled placeholder data**: Metrics 1-7, 10-14, 41-55, 57, 60 
   still contain original placeholder values from ukMarkets.ts. These 
   should be treated as estimates only until verified via Data Entry 
   or future scrapers.

3. **Belfast (uk-76)**: N. Ireland LA codes not covered by NOMIS 
   England/Wales datasets. M33, M35, M36 have data via Claimant Count 
   (which covers all UK), but BRES M40 is null.

---

## Recommended Next Steps (in order)

1. **Build frontend validation layer** — metricValidation.ts with bounds 
   for all 60 metrics, wired into Data Entry panel with inline warnings
2. **Enter commercial data** — team uses Data Entry panel for CoStar/MSCI 
   metrics (vacancy, rents, yields, take-up: metrics 1-4, 41-50)
3. **Retry M37** — investigate NM_17_5 dataset availability or find 
   alternative APS data source on NOMIS
4. **Build pdf_scraper.py** — when broker PDFs are available
5. **Add ASHE scraper** — for M38/M39 (wage indices) via NOMIS ASHE dataset

---

## Architecture Decisions Made
- Zustand store for shared state (replaces direct loadMarkets() calls)
- master_data.json loaded async on app init, merged into localStorage
- Source priority: VERIFIED > ESTIMATED > REGIONAL_PROXY
- Regional proxy = write-time fan-out to all markets in region
- Scoring excludes null metrics and empty pillars (weight redistribution)
- All Python scrapers use only free APIs (no auth required)
- Overpass scraper has 12s delay + checkpoint/resume for fair use
