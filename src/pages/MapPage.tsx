import { useState, useEffect } from 'react';
import { loadMarkets } from '../utils/storage';
import { rankMarkets } from '../utils/scoring';
import type { ScoredMarket } from '../types';
import MarketMap from '../components/map/MarketMap';
import MarketProfilePanel from '../components/map/MarketProfilePanel';

export default function MapPage() {
  const [ranked, setRanked] = useState<ScoredMarket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [region, setRegion] = useState('All regions');

  useEffect(() => {
    setRanked(rankMarkets(loadMarkets()));
  }, []);

  const regions = ['All regions', ...Array.from(new Set(ranked.map(m => m.market.region))).sort()];
  const filtered = region === 'All regions' ? ranked : ranked.filter(m => m.market.region === region);

  const selectedMarket = ranked.find(m => m.market.id === selectedId) ?? null;

  const tierCounts = {
    t1: filtered.filter(m => m.totalScore >= 80).length,
    t2: filtered.filter(m => m.totalScore >= 60 && m.totalScore < 80).length,
    t3: filtered.filter(m => m.totalScore < 60).length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0 flex-wrap">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Market Map</h1>
          <p className="text-xs text-gray-400">{ranked.length} markets · click a marker to see its profile</p>
        </div>

        {/* Tier pills */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Tier 1', count: tierCounts.t1, colour: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Tier 2', count: tierCounts.t2, colour: '#b45309', bg: '#fffbeb', border: '#fde68a' },
            { label: 'Tier 3', count: tierCounts.t3, colour: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
          ].map(t => (
            <div
              key={t.label}
              className="rounded-lg px-3 py-1.5 border flex items-center gap-2 text-xs"
              style={{ background: t.bg, borderColor: t.border }}
            >
              <span className="font-bold text-sm" style={{ color: t.colour }}>{t.count}</span>
              <span className="font-medium text-gray-700">{t.label}</span>
            </div>
          ))}
        </div>

        {/* Region filter */}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Region:</label>
          <select
            value={region}
            onChange={e => {
              setRegion(e.target.value);
              setSelectedId(null);
            }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-purple-400 bg-white"
            style={{ minWidth: 160 }}
          >
            {regions.map(r => (
              <option key={r} value={r}>
                {r === 'All regions' ? `All regions (${ranked.length})` : `${r} (${ranked.filter(m => m.market.region === r).length})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Map + panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {ranked.length > 0 && (
            <MarketMap
              markets={filtered}
              selectedId={selectedId}
              onSelect={id => setSelectedId(prev => prev === id ? null : id)}
            />
          )}
        </div>

        {/* Profile panel */}
        <div
          className="flex-shrink-0 border-l border-gray-200 bg-white overflow-hidden transition-all duration-200"
          style={{ width: selectedMarket ? 360 : 0 }}
        >
          {selectedMarket && (
            <MarketProfilePanel
              market={selectedMarket}
              totalCount={ranked.length}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
