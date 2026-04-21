# TASKS — Brunswick Screening Framework

## Last Updated
21 April 2026

## Current Status
Application covers **75 markets** (Belfast removed v4), scored across **6 pillars
and 72 metrics**. Newmark Q3 2025 regional data is now integrated end-to-end:
scraped from PDF → merged into master_data.json → surfaced in map regional-zone
layer with per-region detail panel. Live UK 10-year gilt yield pipeline built
with BoE/DMO fallback, used to calculate `newmark_yield_spread`. Data Sources
page shows live gilt yield card and Newmark attribution.

---

## Completed This Session

### Newmark PDF scraper (Section 1)
- [x] `scrapers/newmark_scraper.py` — extracts regional rents, yields, ERV,
      reversion, vacancy, growth forecast, pipeline from the Q3 2025 PDF
- [x] Coverage achieved: 559 records across 75 markets, 100% of named prime-
      rent locations text-verified, 100% of stated yield figures text-verified
- [x] `public/data/newmark_locations.json` — 51 named micro-locations with
      coords for map dot layer
- [x] Chart-approximated values (vacancy, reversion, pipeline sqft) carry
      `extraction_method: "chart_approximation"` + `accuracy_note: "±2 pp"`

### Live gilt yield fetcher (Section 4)
- [x] `scrapers/gilt_yield_fetcher.py` — BoE IUDBELLS → DMO → cache fallback
- [x] `scrapers/config/gilt_yield_cache.json` — bootstrap seeded at 4.35%,
      meant to be overwritten by first successful live fetch
- [x] Graceful fallback when all live sources fail (cache or minimal error
      payload with `is_cached_fallback: true`)
- [x] `data_merger.py` copies cache to `public/data/gilt_yield_cache.json`
      so the Data Sources page can fetch it

### New metrics (Section 2)
- [x] `src/config/metricValidation.ts` — M41/M42 redefined £psf, M65-M72 added
- [x] `src/data/metrics.ts` — scoring bands for all new metrics
- [x] Store migration v4 → v5 clears legacy index values from M41/M42

### Data merger (Section 5)
- [x] `scrapers/data_merger.py` — Newmark input added with string→numeric ID map
- [x] `newmark_yield_spread` calculated at merge time (equivalent yield - gilt)
- [x] Stale gilt cache (>7d) flags spread as REVIEW_NEEDED
- [x] Belfast records dropped from all legacy scraper outputs
- [x] Rich pillar-by-pillar coverage report; Rents & Yields now has 6×75 cells
      of new data (prev ~0)

### Map upgrades (Section 3)
- [x] `scrapers/region_boundaries_scraper.py` — ITL1 regions + London boroughs
- [x] `public/data/newmark_region_mapping.json` — ONS code/name → Newmark 12 regions
- [x] `src/components/map/LayerControl.tsx` — top-right toggle panel
- [x] `src/components/map/RegionDetailPanel.tsx` — slide-in panel with 4 charts
- [x] `src/components/map/charts/` — OccupierMix, UnitSizeDonut, PipelineDonut,
      RentGrowthBar (all Recharts)
- [x] `MarketMap.tsx` — regional zone layer with yield-gradient colouring,
      micro-location dot layer (size ∝ rent), region click → panel
- [x] `MapPage.tsx` — wires all four Newmark/choropleth/POI/portfolio layers
      through LayerControl. Default: regional zones ON, market dots OFF.

### Data Sources page (Section 6)
- [x] `src/components/sources/LiveGiltYieldCard.tsx` — shows current yield, source,
      fetch date, age, cached-fallback warning, refresh-instructions button
- [x] Newmark source block with attribution + chart-approximation note +
      `Steve.Sharman@nmrk.com` contact

---

## Metrics coverage snapshot (post-Newmark merge)

| Pillar          | Metrics populated                                    |
|-----------------|------------------------------------------------------|
| Supply          | M61-M64 (70/75) · M69 (75/75)                        |
| Demand          | M15, M16, M70 (75/75 each)                           |
| Connectivity    | M21-M25 (75/75 each)                                 |
| Labour          | M31-M33, M35-M40 (75/75 each) · M34 (67/75)          |
| Rents & Yields  | M41, M65, M66, M67, M68 (75/75) · M42 (32/75)        |
| Strategic/Risk  | M58 (75/75) · M72 (75/75)                            |

Total: **2,254 verified + estimated metric values** across 75 markets.

---

## Previously completed (still valid)

### React Application
- [x] All 9 pages live: Home (landing), Rankings, Map, Dashboard, Sensitivity,
      Data Entry, Data Sources, Pipeline, Compare, plus Add/Edit Market and
      printable one-pager
- [x] Zustand store with localStorage persistence + versioned migrations
- [x] master_data.json auto-loaded on init, merged respecting source priority
- [x] Completeness badges, RAG tiers, thesis filters with auto-sort, pipeline
      status chips, inline pillar drill-down, sparklines, rank-movement arrows
- [x] CartoDB Positron basemap with minimal grey/white aesthetic
- [x] Radius tool, portfolio asset overlay, LAD choropleth (opt-in)

### Data Pipeline
- [x] nomis_scraper, overpass_scraper, environment_agency_scraper,
      sepa_flood_scraper, voa_scraper, data_merger — production ready
- [x] Source priority: VERIFIED > ESTIMATED > REGIONAL_PROXY > REVIEW_NEEDED

---

## Not Yet Built / Next Priorities

1. **Replace placeholder data** — metrics 1-7, 10-14, 43-55, 57, 60 still
   contain original hallucinated values from an early session. Team should
   use Data Entry panel for CoStar/MSCI commercial data.
2. **Run the two optional scrapers** (for map layers):
   - `python scrapers/poi_scraper.py` — motorway network lines (blue overlay)
   - `python scrapers/lad_boundaries_scraper.py` — LAD polygons (choropleth)
   - `python scrapers/region_boundaries_scraper.py` — ITL1 + London boroughs
     (Newmark regional zone layer)
3. **Live gilt yield** — from a networked machine: `python scrapers/gilt_yield_fetcher.py`
4. **M37 (economic activity rate)** — NOMIS NM_17_5 returns 0 rows; needs
   alternate dataset or direct ONS APS fetch
5. **ASHE scraper** for M38/M39 wage indices
6. **pdf_scraper.py** — reusable broker PDF extraction (pdfplumber + NuExtract);
   blocked on broker PDFs being placed in `scrapers/pdfs/`
7. **IM upload** → portfolio asset profile extraction (hooks into
   `addPortfolioAsset()` in the store)

---

## Known Issues

1. **Default rate (newmark_default_rate / M71)** — Newmark PDF page 19
   describes the chart but does not print a numeric value. M71 is defined
   in metricValidation.ts but currently unpopulated. Needs a chart-pixel
   pass OR user-provided baseline.
2. **Inner vs Greater London** — matrix has a single `uk-01 Greater London`
   market; Inner/Greater split is map-only. Inner London receives the same
   Greater London cascade values but displays its own prime-rent range
   (from Park Royal, Inner London micro-locations) in the region panel.
3. **Wales markets** — 3 markets (Cardiff, Newport, Swansea) get Newmark
   Wales cascade values. 3 out of ~9-12 Newmark regions have ≥ 5 markets;
   the rest have fewer.
4. **Pre-filled placeholder data** — M1-M7, M10-M14, M43-M50, M55-M60
   in `src/data/ukMarkets.ts` still contain hallucinated values from a
   previous Claude session. Data Entry panel is the intended replacement.
5. **M37 (economic activity)** — all 75 markets null; NOMIS dataset
   NM_17_5 returns empty queries.

---

## Architecture Decisions (this session)

- **Newmark metric IDs**: M41/M42 redefined in-place (index → £psf) with
  store migration to clear legacy values. Added M65-M72 for new metrics.
- **Yield spread**: calculated in merger, not scraper, so updating the gilt
  yield cache automatically refreshes all spread values on next merge run.
- **Chart-approximated values** (vacancy, reversion): carry
  `extraction_method: "chart_approximation"` + `accuracy_note`. UI shows
  with `~` tilde prefix.
- **Regional zones default ON**: primary map layer is now yield-coloured
  polygons, not score dots. Dots and LAD choropleth are opt-in layers.
- **Inner London**: treated as a subset of Greater London for scoring;
  map-only visual split via inner_london_lad_codes list.
- **Belfast removed** (v4, 76→75): NI gaps in VOA + NOMIS BRES made data
  unreliable.
