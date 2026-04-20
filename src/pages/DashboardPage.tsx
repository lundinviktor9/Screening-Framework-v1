import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import type { ScoredMarket } from '../types';
import { PILLARS } from '../data/metrics';
import MarketRadar from '../components/dashboard/MarketRadar';
import PillarBars from '../components/dashboard/PillarBars';
import HeatmapTable from '../components/dashboard/HeatmapTable';
import RAGBadge from '../components/rankings/RAGBadge';

const COLOURS = ['#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#DB2777'];
const MAX_SELECT = 5;

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const _tick = useMarketStore(s => s._lastTick);

  const allMarkets = useMemo(() => getScoredMarkets(), [markets, _tick]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<'radar' | 'bars' | 'heatmap'>('radar');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || allMarkets.length === 0) return;
    const preselect = searchParams.get('market');
    if (preselect) {
      setSelected([preselect]);
    } else {
      setSelected(allMarkets.slice(0, Math.min(3, allMarkets.length)).map(m => m.market.id));
    }
    setInitialized(true);
  }, [allMarkets, initialized, searchParams]);

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < MAX_SELECT
        ? [...prev, id]
        : prev
    );
  }

  const selectedMarkets = allMarkets.filter(m => selected.includes(m.market.id));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Compare up to 5 markets across pillars and metrics.</p>
      </div>

      {/* Market selector */}
      <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5 mb-6">
        <div className="text-sm font-semibold text-gray-700 mb-3">
          Select markets to compare ({selected.length}/{MAX_SELECT})
        </div>
        <div className="flex flex-wrap gap-2">
          {allMarkets.map((sm) => {
            const isSelected = selected.includes(sm.market.id);
            return (
              <button
                key={sm.market.id}
                onClick={() => toggle(sm.market.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  isSelected
                    ? 'text-white border-transparent'
                    : 'text-gray-600 border-gray-200 hover:border-purple-300 bg-white'
                }`}
                style={isSelected ? { background: COLOURS[selected.indexOf(sm.market.id) % COLOURS.length] } : {}}
              >
                <span className="font-mono text-xs opacity-60">#{sm.rank}</span>
                {sm.market.name}
                <span className={`text-xs font-bold ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                  {sm.totalScore.toFixed(0)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedMarkets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Select at least one market above.</div>
      ) : (
        <>
          {/* Scorecards */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${Math.min(selectedMarkets.length, 3)}, 1fr)` }}>
            {selectedMarkets.map((sm, i) => (
              <div
                key={sm.market.id}
                className="bg-white rounded-xl border shadow-sm p-5"
                style={{ borderColor: COLOURS[i % COLOURS.length] + '40' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div
                      className="text-xs font-bold uppercase tracking-wide mb-0.5"
                      style={{ color: COLOURS[i % COLOURS.length] }}
                    >
                      #{sm.rank} {sm.market.region}
                    </div>
                    <div className="font-bold text-gray-900">{sm.market.name}</div>
                  </div>
                  <RAGBadge rag={sm.rag} />
                </div>

                <div
                  className="text-4xl font-bold mb-3"
                  style={{ color: sm.rag === 'Green' ? '#15803d' : sm.rag === 'Amber' ? '#b45309' : '#b91c1c' }}
                >
                  {sm.totalScore.toFixed(1)}
                  <span className="text-base text-gray-400 font-normal ml-1">/ 100</span>
                </div>

                <div className="space-y-1.5">
                  {PILLARS.map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <div className="text-xs text-gray-500 w-24 truncate">{p.name}</div>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${((sm.pillarScores[p.name]?.score ?? 0) / 5) * 100}%`,
                            background: COLOURS[i % COLOURS.length],
                          }}
                        />
                      </div>
                      <div className="text-xs font-semibold text-gray-600 w-6 text-right">
                        {(sm.pillarScores[p.name]?.score ?? 0).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5">
            <div className="flex gap-2 mb-5">
              {(['radar', 'bars', 'heatmap'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    tab === t ? 'text-white' : 'text-gray-500 hover:bg-purple-50'
                  }`}
                  style={tab === t ? { background: '#3B1F6B' } : {}}
                >
                  {t === 'radar' ? 'Radar Chart' : t === 'bars' ? 'Pillar Bars' : 'Heatmap (60 metrics)'}
                </button>
              ))}
            </div>

            {tab === 'radar' && <MarketRadar markets={selectedMarkets} />}
            {tab === 'bars'  && <PillarBars markets={selectedMarkets} />}
            {tab === 'heatmap' && <HeatmapTable markets={selectedMarkets} />}
          </div>
        </>
      )}
    </div>
  );
}
