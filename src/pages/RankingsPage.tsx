import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadMarkets, deleteMarket, resetToDefaults, saveMarkets } from '../utils/storage';
import { rankMarkets } from '../utils/scoring';
import { exportToCSV, parseImportedCSV } from '../utils/csvImportExport';
import type { ScoredMarket } from '../types';
import RankingsTable from '../components/rankings/RankingsTable';

export default function RankingsPage() {
  const [ranked, setRanked] = useState<ScoredMarket[]>([]);
  const [region, setRegion] = useState('All regions');
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  function load() {
    const markets = loadMarkets();
    setRanked(rankMarkets(markets));
  }

  useEffect(() => { load(); }, []);

  function handleDelete(id: string) {
    if (confirm('Delete this market?')) {
      deleteMarket(id);
      load();
    }
  }

  function handleReset() {
    if (confirm('Reset all markets to the default 77 UK pre-filled dataset? Any manual edits will be lost.')) {
      resetToDefaults();
      load();
    }
  }

  function handleExport() {
    exportToCSV(loadMarkets());
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseImportedCSV(text, loadMarkets());
      saveMarkets(result.updatedMarkets);
      load();
      const msg = `Updated ${result.valuesUpdated} values across ${result.marketsUpdated} markets.` +
        (result.warnings.length > 0 ? ` ${result.warnings.length} warning(s) — check console.` : '');
      setImportMsg({ text: msg, ok: result.warnings.length === 0 });
      if (result.warnings.length > 0) console.warn('CSV import warnings:', result.warnings);
      setTimeout(() => setImportMsg(null), 6000);
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported if needed
    e.target.value = '';
  }

  // Unique regions sorted
  const regions = ['All regions', ...Array.from(new Set(ranked.map(m => m.market.region))).sort()];
  const filtered = region === 'All regions' ? ranked : ranked.filter(m => m.market.region === region);

  // Re-rank filtered list (keep global rank numbers but filter display)
  const tierCounts = {
    t1: filtered.filter(m => m.totalScore >= 80).length,
    t2: filtered.filter(m => m.totalScore >= 60 && m.totalScore < 80).length,
    t3: filtered.filter(m => m.totalScore < 60).length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Rankings</h1>
          <p className="text-gray-500 text-sm mt-1">
            {ranked.length} markets · 6 pillars · 60 metrics · ~23 metrics pre-filled from public data
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleReset}
            className="px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Reset to defaults
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors"
            style={{ color: '#3B1F6B', borderColor: '#3B1F6B', background: 'transparent' }}
            title="Download all markets as a CSV file you can edit in Excel"
          >
            Export CSV
          </button>
          <button
            onClick={handleImportClick}
            className="px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors"
            style={{ color: '#3B1F6B', borderColor: '#3B1F6B', background: 'transparent' }}
            title="Upload a filled CSV to update metric values across all markets"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => navigate('/add')}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#3B1F6B' }}
          >
            + Add Market
          </button>
        </div>
      </div>

      {/* Import result toast */}
      {importMsg && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: importMsg.ok ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${importMsg.ok ? '#bbf7d0' : '#fde68a'}`,
            color: importMsg.ok ? '#15803d' : '#b45309',
          }}
        >
          {importMsg.text}
        </div>
      )}

      {/* Tier summary + region filter */}
      {ranked.length > 0 && (
        <div className="flex gap-4 mb-5 items-start flex-wrap">
          {[
            { label: 'Tier 1 — Core targets', sub: '≥ 80', count: tierCounts.t1, colour: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Tier 2 — Value-add', sub: '60–79', count: tierCounts.t2, colour: '#b45309', bg: '#fffbeb', border: '#fde68a' },
            { label: 'Tier 3 — Monitor', sub: '< 60', count: tierCounts.t3, colour: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
          ].map(t => (
            <div key={t.label} className="rounded-xl px-4 py-3 border flex items-center gap-3" style={{ background: t.bg, borderColor: t.border }}>
              <div className="text-2xl font-bold" style={{ color: t.colour }}>{t.count}</div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">{t.label}</div>
                <div className="text-xs text-gray-400">{t.sub}</div>
              </div>
            </div>
          ))}

          {/* Region filter */}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-gray-500 font-medium whitespace-nowrap">Filter by region:</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white"
              style={{ minWidth: 180 }}
            >
              {regions.map(r => (
                <option key={r} value={r}>
                  {r === 'All regions' ? `All regions (${ranked.length})` : `${r} (${ranked.filter(m => m.market.region === r).length})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <RankingsTable markets={filtered} onDelete={handleDelete} />
    </div>
  );
}
