import { useEffect, useState } from 'react';

/**
 * UnderwritingPanel - deal-detail panel for the MLI underwrite stage (Mode A/B) with full
 * audit capture: each flag shows WHY it is a judgement call (rationale) and takes a resolution
 * note; each run is versioned with an analyst "what changed & why" note; the machine's first
 * run is the frozen baseline and the history shows how numbers moved.
 *
 * Mirrors extractor/underwrite_routes.py and underwrite/INTERFACE.md (HITL mandatory; returns
 * withheld unless checks.pass).
 */

const API_BASE = 'http://localhost:8787';

type Flag = Record<string, any>;
interface Props { dealId: string }

const pct = (x?: number | null) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);
const mult = (x?: number | null) => (x == null ? '—' : `${x.toFixed(2)}×`);
const gbp = (x?: number | null) =>
  x == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(x);
const flagKey = (f: Flag) => `${f.unit || ''}|${f.signal || f.field || ''}`;

export function UnderwritingPanel({ dealId }: Props) {
  const [block, setBlock] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mappingOk, setMappingOk] = useState(false);
  const [flagsOk, setFlagsOk] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, string>>({}); // flagKey -> note
  const [analyst, setAnalyst] = useState('');
  const [changeNote, setChangeNote] = useState('');

  const [gapOverrides, setGapOverrides] = useState<Record<string, string>>({}); // field -> value

  const [entryDate, setEntryDate] = useState('');
  const [holdYears, setHoldYears] = useState('5');
  const [entryYield, setEntryYield] = useState('');
  const [exitYield, setExitYield] = useState('6.25');
  const [rentalGrowth, setRentalGrowth] = useState('4.5');
  const [ltv, setLtv] = useState('0');
  const [scenario, setScenario] = useState('1');

  const [editingMapping, setEditingMapping] = useState(false);
  const [mappingEdits, setMappingEdits] = useState<Record<string, string>>({});
  const [mappingSaveBusy, setMappingSaveBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/underwrite/${dealId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(b => b && setBlock(b))
      .catch(() => {});
  }, [dealId]);

  async function handleUpload(file: File) {
    setBusy(true); setErr(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`${API_BASE}/underwrite/${dealId}`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).detail || 'Upload failed');
      const data = await r.json();
      setBlock(data); setMappingOk(false); setFlagsOk(false); setResolutions({});
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function handleSaveMapping() {
    if (!block?.mapping) return;
    setMappingSaveBusy(true);
    try {
      const correctedMapping = { ...block.mapping };
      if (correctedMapping.columns) {
        Object.entries(mappingEdits).forEach(([k, v]) => {
          correctedMapping.columns[k] = v;
        });
      }
      const r = await fetch(`${API_BASE}/underwrite/${dealId}/confirm-mapping`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: correctedMapping }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || 'Failed to save mapping');
      const data = await r.json();
      setBlock(data);
      setEditingMapping(false);
      setMappingEdits({});
      setMappingOk(false);
    } catch (e: any) { setErr(e.message); } finally { setMappingSaveBusy(false); }
  }

  async function handleRun() {
    if (!entryDate) { setErr('Entry date is required.'); return; }
    if (!mappingOk) { setErr('Column mapping must be reviewed & checked.'); return; }
    if (!flagsOk) { setErr('Judgement flags must be reviewed & resolved.'); return; }

    setBusy(true); setErr(null);
    try {
      const num = (s: string) => (s.trim() === '' ? null : Number(s));
      const dec = (s: string) => (s.trim() === '' ? null : Number(s) / 100);
      const assumptions = {
        entry_date: entryDate, hold_years: num(holdYears), entry_yield: dec(entryYield),
        exit_yield: dec(exitYield), rental_growth: dec(rentalGrowth), ltv: dec(ltv), scenario: num(scenario),
      };
      // Only send overrides the analyst actually filled in (non-empty), for fields with gaps.
      const gap_overrides: Record<string, number> = {};
      Object.entries(gapOverrides).forEach(([field, v]) => {
        if (v.trim() !== '') gap_overrides[field] = Number(v);
      });
      const flag_resolutions = (block?.flags || []).map((f: Flag) => ({
        unit: f.unit, signal: f.signal, field: f.field,
        decision: 'reviewed', note: resolutions[flagKey(f)] || '',
      }));
      const r = await fetch(`${API_BASE}/underwrite/${dealId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assumptions, gap_overrides, flag_resolutions, mapping_signed_off: mappingOk, flags_signed_off: flagsOk,
          analyst: analyst || null, note: changeNote || null,
        }),
      });
      if (!r.ok) {
        const errData = await r.json();
        throw new Error(errData.detail || `Server error (${r.status}): Run failed`);
      }
      // refetch the full block so history/baseline render
      const fresh = await fetch(`${API_BASE}/underwrite/${dealId}`).then(x => x.json());
      setBlock(fresh); setChangeNote('');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  const flags: Flag[] = block?.flags || [];
  const gaps: any[] = block?.gaps || [];
  const hasUpload = !!block?.status;
  const checks = block?.checks;
  const showReturns = !!checks?.pass && block?.returns;
  const runs: any[] = (block?.runs || []).filter((r: any) => r.type !== 'mapping_correction');

  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 uppercase">Underwriting</label>

      <div className="mt-2">
        <label className="block w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 text-center text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
          {busy ? 'Working…' : hasUpload ? 'Replace rent roll' : 'Upload rent roll (.xlsx)'}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy}
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </label>
      </div>

      {err && <div className="mt-2 bg-red-50 border border-red-300 rounded p-3 text-xs text-red-800 font-medium">
        <div>❌ Error: {err}</div>
        <div className="mt-1 text-red-700 text-xs">Check: Is the extractor running? (<code className="bg-red-100 px-1">npm run extractor</code>) Is LibreOffice installed? (<code className="bg-red-100 px-1">soffice --version</code>)</div>
      </div>}

      {hasUpload && (
        <div className="mt-3 space-y-4">
          <div className="text-xs text-gray-500">
            {block?.units ?? '—'} units · {block?.asset} · {block?.region}
            {block?.mapping?._source && <> · <span className="font-medium">{block.mapping._source}</span></>}
          </div>

          {block?.schema_errors?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
              <div className="font-semibold">Schema issues</div>
              <ul className="list-disc list-inside mt-1">{block.schema_errors.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}

          {block?.mapping && (
            <div className="text-xs border rounded p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-600">Column mapping</div>
                {!editingMapping && (
                  <button onClick={() => { setEditingMapping(true); setMappingEdits({}); }}
                    className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">
                    Edit
                  </button>
                )}
              </div>
              {!editingMapping ? (
                <div className="space-y-1">
                  {Object.entries(block.mapping.columns || {}).map(([schema, col]: any) => (
                    <div key={schema} className="flex justify-between gap-2 bg-gray-50 p-1 rounded">
                      <span className="text-gray-600">{schema}</span>
                      <span className="font-medium text-right text-gray-900">{col}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                    <div className="font-medium text-blue-900">Edit column assignments</div>
                    <div className="text-blue-700 text-xs mt-0.5">Select which source column maps to each schema field</div>
                  </div>
                  {block?.sample_rows?.[0] && (
                    <div>
                      {Object.keys(block.mapping.columns || {}).map((schema: string) => {
                        const currentCol = mappingEdits[schema] ?? (block.mapping.columns?.[schema] || '');
                        const availableCols = Object.keys(block.sample_rows[0] || {});
                        return (
                          <div key={schema} className="grid grid-cols-2 gap-2 mb-2">
                            <div className="text-gray-600">{schema}</div>
                            <select value={currentCol} onChange={(e) => setMappingEdits(s => ({ ...s, [schema]: e.target.value }))}
                              className="border rounded px-1 py-0.5 bg-white text-gray-900">
                              <option value="">(not mapped)</option>
                              {availableCols.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button onClick={handleSaveMapping} disabled={mappingSaveBusy}
                      className="flex-1 px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300">
                      {mappingSaveBusy ? 'Saving…' : 'Save mapping'}
                    </button>
                    <button onClick={() => { setEditingMapping(false); setMappingEdits({}); }}
                      className="flex-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {block?.sample_rows?.length > 0 && (
            <details className="text-xs" open>
              <summary className="cursor-pointer font-semibold text-gray-600">Sample parsed rows</summary>
              <div className="mt-1 space-y-1">
                {block.sample_rows.map((row: any, i: number) => (
                  <div key={i} className="bg-gray-50 border rounded p-2">
                    {Object.entries(row).slice(0, 8).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2"><span className="text-gray-500">{k}</span><span className="font-medium text-right">{String(v)}</span></div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Judgement flags: rationale (why) + resolution note (per flag) */}
          {flags.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold text-gray-600">Judgement flags ({flags.length}) — review each</div>
              <ul className="mt-1 space-y-2">
                {flags.map((f, i) => (
                  <li key={i} className="bg-yellow-50 border border-yellow-200 rounded p-2">
                    <div className="font-medium">{f.unit ? `${f.unit}: ` : ''}{f.signal || f.field}</div>
                    {f.rationale && <div className="text-gray-600 mt-0.5"><span className="font-semibold">Why:</span> {f.rationale}</div>}
                    {f.note && <div className="text-gray-500">{f.note}</div>}
                    <input
                      placeholder="resolution note (how you treated it)…"
                      value={resolutions[flagKey(f)] || ''}
                      onChange={e => setResolutions(s => ({ ...s, [flagKey(f)]: e.target.value }))}
                      className="mt-1 w-full border rounded px-1 py-0.5"
                    />
                    {f.resolution?.note && <div className="text-green-700 mt-0.5">✓ {f.resolution.note}{f.resolution.analyst ? ` — ${f.resolution.analyst}` : ''}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs space-y-1">
            <label className="flex items-center gap-2"><input type="checkbox" checked={mappingOk} onChange={e => setMappingOk(e.target.checked)} /> Column mapping reviewed &amp; correct</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={flagsOk} onChange={e => setFlagsOk(e.target.checked)} /> Judgement flags reviewed &amp; resolved</label>
          </div>

          {/* Gap overrides: deal-level defaults for schedule fields the broker left blank.
              Each row is disabled when the schedule is complete for that field (0 gaps). */}
          {gaps.length > 0 && (
            <div className="text-xs border rounded p-3 bg-white">
              <div className="font-semibold text-gray-600 mb-1">Gap overrides</div>
              <div className="text-gray-500 mb-2">Fill missing per-unit values with a deal-level default. Blank cells only — broker data is never overwritten.</div>
              <div className="space-y-2">
                {gaps.map((g: any) => {
                  const complete = g.missing === 0;
                  return (
                    <div key={g.field} className="grid grid-cols-2 gap-2 items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-700">{g.field}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                          {complete ? 'complete' : `${g.missing}/${g.total} missing`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          disabled={complete}
                          value={gapOverrides[g.field] ?? ''}
                          onChange={e => setGapOverrides(s => ({ ...s, [g.field]: e.target.value }))}
                          placeholder={complete ? '—' : `default ${g.unit}`}
                          className={`w-full border rounded px-1 py-0.5 ${complete ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white'}`}
                          title={complete ? 'Schedule complete for this field — nothing to override' : `Fill ${g.missing} blank cell(s) with this value (${g.unit})`}
                        />
                        <span className="text-gray-400 w-10 shrink-0">{g.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-xs grid grid-cols-2 gap-2">
            <Field label="Entry date *"><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full border rounded px-1 py-0.5" /></Field>
            <Field label="Hold (yrs)"><input type="number" value={holdYears} onChange={e => setHoldYears(e.target.value)} className="w-full border rounded px-1 py-0.5" /></Field>
            <Field label="Entry yield % (opt)"><input type="number" step="0.05" value={entryYield} onChange={e => setEntryYield(e.target.value)} className="w-full border rounded px-1 py-0.5" /></Field>
            <Field label="Exit yield %"><input type="number" step="0.05" value={exitYield} onChange={e => setExitYield(e.target.value)} className="w-full border rounded px-1 py-0.5" /></Field>
            <Field label="Rental growth %"><input type="number" step="0.1" value={rentalGrowth} onChange={e => setRentalGrowth(e.target.value)} className="w-full border rounded px-1 py-0.5" /></Field>
            <Field label="LTV %"><input type="number" step="1" value={ltv} onChange={e => setLtv(e.target.value)} className="w-full border rounded px-1 py-0.5" /></Field>
            <Field label="Scenario">
              <select value={scenario} onChange={e => setScenario(e.target.value)} className="w-full border rounded px-1 py-0.5">
                <option value="1">1 · Base UK SPV</option><option value="2">2 · Alt</option><option value="3">3 · Alt</option><option value="4">4 · Alt</option>
              </select>
            </Field>
            <Field label="Analyst"><input value={analyst} onChange={e => setAnalyst(e.target.value)} className="w-full border rounded px-1 py-0.5" /></Field>
          </div>

          <Field label="Change note (what differs from the machine output & why)">
            <textarea value={changeNote} onChange={e => setChangeNote(e.target.value)} rows={2} className="w-full border rounded px-1 py-0.5 text-xs" />
          </Field>

          {/* Run button with helper text for disabled state */}
          <div>
            <button onClick={handleRun} disabled={busy || !mappingOk || !flagsOk || !entryDate}
              className={`w-full px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                busy || !mappingOk || !flagsOk || !entryDate
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title={!mappingOk ? 'Check mapping reviewed & correct' :
                     !flagsOk ? 'Check flags reviewed & resolved' :
                     !entryDate ? 'Entry date is required' :
                     ''}
            >
              {busy ? '⏳ Running (this can take ~30s, LibreOffice is recalculating)…' : 'Run underwrite'}
            </button>
            {!busy && (
              <div className="mt-2 text-xs text-gray-600 space-y-1">
                {!mappingOk && <div className="flex items-center gap-1">
                  <span className="text-amber-600">•</span> Check <span className="font-semibold">mapping reviewed &amp; correct</span>
                </div>}
                {!flagsOk && <div className="flex items-center gap-1">
                  <span className="text-amber-600">•</span> Check <span className="font-semibold">flags reviewed &amp; resolved</span>
                </div>}
                {!entryDate && <div className="flex items-center gap-1">
                  <span className="text-amber-600">•</span> Set <span className="font-semibold">Entry date *</span>
                </div>}
              </div>
            )}
          </div>

          {checks && !checks.pass && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
              Checks failed — returns withheld (no false precision). Tie-out: {checks.anchor_tieout_ok ? 'ok' : 'FAIL'}; error cells: {checks.workbook_error_cells}.
            </div>
          )}

          {showReturns && (
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase">Returns {block?.latest_version ? `(v${block.latest_version})` : ''}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-800">✓ pass · tie-out ok · {checks.workbook_error_cells} errs</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Metric label="Net purchase price" value={gbp(block?.returns?.net_purchase_price)} />
                <Metric label="Unlevered IRR" value={pct(block?.returns?.unlevered_irr)} />
                <Metric label="Net investor IRR" value={pct(block?.returns?.net_investor_irr)} />
                <Metric label="Equity multiple" value={mult(block?.returns?.equity_multiple)} />
                <Metric label="Cash-on-cash" value={pct(block?.returns?.cash_on_cash)} />
              </div>
              <a href={`${API_BASE}/underwrite/${dealId}/model`} className="mt-3 block w-full text-center px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm">Download editable model (.xlsx)</a>
            </div>
          )}

          {/* Run history (audit trail) */}
          {runs.length > 0 && (
            <details className="text-xs" open>
              <summary className="cursor-pointer font-semibold text-gray-600">Run history ({runs.length})</summary>
              <ul className="mt-1 space-y-1">
                {runs.slice().reverse().map((r, i) => (
                  <li key={i} className="bg-gray-50 border rounded p-2">
                    <div className="flex justify-between">
                      <span className="font-medium">v{r.version}{r.is_baseline ? ' · machine baseline' : ''}{r.analyst ? ` · ${r.analyst}` : ''}</span>
                      <span className={r.passed ? 'text-green-700' : 'text-red-700'}>{r.passed ? 'pass' : 'checks failed'}</span>
                    </div>
                    <div className="text-gray-600">Unlev {pct(r.returns?.unlevered_irr)} · EM {mult(r.returns?.equity_multiple)} · NetPP {gbp(r.returns?.net_purchase_price)}</div>
                    {r.note && <div className="text-gray-700 italic mt-0.5">{r.note}</div>}
                    {r.vs_baseline && Object.keys(r.vs_baseline).length > 0 && (
                      <div className="text-gray-500 mt-0.5">vs baseline: {Object.entries(r.vs_baseline).map(([k, v]: any) => `${k} ${v.from}→${v.to}`).join(', ')}</div>
                    )}
                    <a href={`${API_BASE}/underwrite/${dealId}/model?version=${r.version}`} className="text-blue-600">model v{r.version}</a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><div className="text-gray-500">{label}</div>{children}</div>);
}
function Metric({ label, value }: { label: string; value: string }) {
  return (<div className="text-sm"><div className="text-xs text-gray-600">{label}</div><div className="font-semibold">{value}</div></div>);
}
