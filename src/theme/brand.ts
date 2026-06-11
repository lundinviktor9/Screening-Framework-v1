/**
 * Brand color tokens — single source of truth for the app AND the PPTX export.
 *
 * Mirrored verbatim in extractor/brand.json (the python-pptx builder reads the same
 * values — Handoff #1 Task 4 contract). The CSS-variable theme in src/index.css and the
 * Tailwind config map onto these same colors; keep all three in sync.
 *
 * The original four keys (purple, purpleLight, ink, cardBg) are retained for backward
 * compatibility with the showcase components and pptx_builder.py.
 */

export const brand = {
  // ── legacy keys (do not remove — consumed by pptx_builder.py + showcase/*) ──
  purple: '#7D5A7D',
  purpleLight: '#E6DCE6',
  ink: '#1F1F1F',
  cardBg: '#F5F4F6',

  // ── full palette (Handoff #2 Task 1.2) ──
  brand: '#7D5A7D',        // primary — sidebar, primary buttons, section bands, active states
  brandLight: '#E6DCE6',   // table header fills, selected rows
  pageBg: '#F7F6F8',       // app page background
  surface: '#FFFFFF',      // cards
  muted: '#6B6B76',        // muted text
  border: '#E5E2E8',

  // semantic
  green: '#1B8A5A',        // pass / on-market / tier-1
  amber: '#B7791F',        // flags / review
  red: '#C53030',          // fail / off / delete
} as const;

export type BrandKey = keyof typeof brand;
