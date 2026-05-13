import { useMemo } from 'react';
import { useMarketStore } from '../../store/marketStore';
import { rankMarkets } from '../../utils/scoring';
import type { ScoredMarket } from '../../types';

function tierColor(score: number) {
  if (score >= 80) return { text: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
  if (score >= 60) return { text: '#b45309', bg: '#fffbeb', border: '#fde68a' };
  return { text: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
}

export function Top10Preview() {
  const markets = useMarketStore(s => s.markets);
  const currentScenario = useMarketStore(s => s.currentScenario);
  const _tick = useMarketStore(s => s._lastTick);

  // Compute current and default rankings
  const currentRanked = useMemo(() => {
    const scored = markets.map(m => {
      const values = { ...m.values };
      for (const key of Object.keys(m.sources)) {
        const id = Number(key);
        if (m.sources[id]?.status === 'REVIEW_NEEDED') {
          values[id] = null;
        }
      }
      return { ...m, values };
    });
    return rankMarkets(scored, currentScenario);
  }, [markets, currentScenario, _tick]);

  const defaultRanked = useMemo(() => {
    const scored = markets.map(m => {
      const values = { ...m.values };
      for (const key of Object.keys(m.sources)) {
        const id = Number(key);
        if (m.sources[id]?.status === 'REVIEW_NEEDED') {
          values[id] = null;
        }
      }
      return { ...m, values };
    });
    return rankMarkets(scored); // No scenario = default behaviour
  }, [markets, _tick]);

  // Create rank lookup from default
  const defaultRankMap: Record<string, number> = {};
  defaultRanked.forEach(m => {
    defaultRankMap[m.market.id] = m.rank;
  });

  // Top 10 with delta vs default
  const top10 = useMemo(() => {
    return currentRanked.slice(0, 10).map(m => {
      const defaultRank = defaultRankMap[m.market.id] ?? 0;
      const delta = defaultRank - m.rank; // positive = moved up
      return { ...m, delta, defaultRank };
    });
  }, [currentRanked, defaultRankMap]);

  return (
    <div className="space-y-3">
      {/* Heading */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Top 10 Ranking Preview</h2>
        <p className="text-xs text-gray-500 mt-1">Real-time ranking with your current metric weights</p>
      </div>

      {/* Table */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-10">#</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Market</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">Score</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">vs Default</th>
            </tr>
          </thead>
          <tbody>
            {top10.map(m => {
              const tc = tierColor(m.totalScore);
              const isDifferent = m.delta !== 0;

              return (
                <tr
                  key={m.market.id}
                  className={`border-b border-gray-50 transition-colors ${isDifferent ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-gray-50'}`}
                >
                  {/* Rank */}
                  <td className="px-4 py-2.5 text-sm font-bold text-gray-500 tabular-nums">
                    {m.rank}
                  </td>

                  {/* Market name */}
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-gray-900">{m.market.name}</span>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className="inline-block text-sm font-bold tabular-nums px-2 py-0.5 rounded-full"
                      style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}
                    >
                      {m.totalScore}
                    </span>
                  </td>

                  {/* Delta */}
                  <td className="px-4 py-2.5 text-center">
                    {m.delta === 0 ? (
                      <span className="text-gray-300 font-medium text-xs">—</span>
                    ) : m.delta > 0 ? (
                      <span className="flex items-center justify-center gap-1 text-green-600 font-semibold text-xs tabular-nums">
                        ▲{m.delta}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-red-500 font-semibold text-xs tabular-nums">
                        ▼{Math.abs(m.delta)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
