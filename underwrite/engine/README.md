# underwrite/engine/ - vendored MLI engine (pinned)

Self-contained copy of the proven MLI underwrite engine. Called by `underwrite/adapter.py`;
not imported by the React app. Built and validated in `C:\MLI`; vendored here so the framework
is version-controlled and deployable.

## Contents

| File | Role |
|---|---|
| `base/MLI_v21_BASE.xlsx` | **Pinned clean base.** West Craig anchor only; ties out GA D16 = 8,203,713.29. Injection target. |
| `inject_deal_v21.py` | Header-driven injector. Resolves template columns BY HEADER, so it re-derives layout from the base (survives column moves). Writes a deal's units + wiring. |
| `verify.py` | Acceptance asserts + v21 checks (anchor tie-out, no text in array columns, ICS clean, guarantee column present). |
| `run_underwrite.py` | Headless recalc + returns extraction (legacy orchestrator). |
| `field_dictionary.md` | Broker-alias -> template-field reference (the normaliser keys off it). |
| `normalisers/` | Per-broker layout adapters (newbury_v3, cannon, meadow, generic rr) + `validate_and_write.py`. |

## Dependencies

- `openpyxl` (see repo requirements).
- **LibreOffice (`soffice`) on PATH** for Mode B recalc. The adapter forces a full
  recalc-on-load (`OOXMLRecalcMode=0`) and re-saves a faithful workbook.

## Re-cutting the pinned base (when the model evolves)

The base is a deliberate snapshot, decoupled from day-to-day model churn:

1. Take the latest signed-off `Newbury vNN.xlsx` from `C:\MLI`.
2. Clear the deal rows: template input rows 43-63 -> blank; Tenancy Inputs C/E for rows 48-68
   -> blank (keeps the per-unit cascade + the SRC row 60).
3. Set the register to the West Craig anchor (CFO Q5=1 / Q6=0).
4. Recalc and confirm GA D16 = 8,203,713.29 to the penny.
5. Replace `base/MLI_v21_BASE.xlsx` and bump this note.

The injector is header-driven, so a column move in the new base does **not** break the adapter
contract - but always re-run `verify.py` after a re-cut.

## Caveat (Excel-safety)

Headless LibreOffice **masks** some Excel errors (coerces text to 0 inside array formulas), so a
headless "0 errors" is necessary, not sufficient. The adapter computes `workbook_error_cells`
with the v21 verify logic; a final Excel `Ctrl+Alt+F9` review is the gold standard before any
number reaches an investment committee.
