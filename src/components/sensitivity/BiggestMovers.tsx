import { useMemo, useState, useEffect } from 'react';
import { useMarketStore } from '../../store/marketStore';
import { rankMarkets } from '../../utils/scoring';
import type { ScoredMarket } from '../../types';

export function BiggestMovers() {
  const markets = useMarketStore(s => s.markets);
  const currentScenario = useMarketStore(s => s.currentScenario);
  const _tick = useMarketStore(s => s._lastTick);
  const [debouncedScenario, setDebouncedScenario] = useState(currentScenario);

  // Debounce scenario changes by 150ms to avoid excessive recalculation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedScenario(currentScenario);
    }, 150);
    return () => clearTimeout(timer);
  }, [currentScenario]);

  // Compute scorable markets (exclude REVIEW_NEEDED values)
  const scorableMarkets = useMemo(() => {
    return markets.map(m => {
      const values = { ...m.values };
      for (const key of Object.keys(m.sources)) {
        const id = Number(key);
        if (m.sources[id]?.status === 'REVIEW_NEEDED') {
          values[id] = null;
        }
      }
      return { ...m, values };
    });
  }, [markets]);

  // Current ranking (with debounced scenario)
  const currentRanked = useMemo(() => {
    return rankMarkets(scorableMarkets, debouncedScenario);
  }, [scorableMarkets, debouncedScenario, _tick]);

  // Default ranking (no scenario)
  const defaultRanked = useMemo(() => {
    return rankMarkets(scorableMarkets);
  }, [scorableMarkets, _tick]);

  // Create rank lookup and score lookup
  const defaultRankMap: Record<string, number> = {};
  const defaultScoreMap: Record<string, number> = {};
  defaultRanked.forEach(m => {
    defaultRankMap[m.market.id] = m.rank;
    defaultScoreMap[m.market.id] = m.totalScore;
  });

  // Calculate movers (rank shift of 2+ ranks)
  const movers = useMemo(() => {
    return currentRanked
      .map(m => {
        const defaultRank = defaultRankMap[m.market.id] ?? m.rank;
        const defaultScore = defaultScoreMap[m.market.id] ?? m.totalScore;
        const rankShift = defaultRank - m.rank;
        const scoreChange = m.totalScore - defaultScore;

        return {
          market: m.market,
          currentRank: m.rank,
          defaultRank,
          currentScore: m.totalScore,
          scoreChange,
          rankShift,
        };
      })
      .filter(m => Math.abs(m.rankShift) >= 2);
  }, [currentRanked, defaultRankMap, defaultScoreMap]);

  // Separate into risers and fallers
  const risers = movers.filter(m => m.rankShift > 0).slice(0, 5);
  const fallers = movers.filter(m => m.rankShift < 0).slice(0, 5);

  const hasMovement = risers.length > 0 || fallers.length > 0;

  return (
    <div className="space-y-3">
      {/* Heading */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Biggest Movers vs Default</h2>
        <p className="text-xs text-gray-500 mt-1">Markets with rank shifts of 2+ positions</p>
      </div>

      {/* No movement state */}
      {!hasMovement && (
        <div className="bg-white border border-gray-100 rounded-lg px-4 py-6 text-center">
          <p className="text-sm text-gray-500">No significant movement from Default</p>
        </div>
      )}

      {/* Risers and Fallers columns */}
      {hasMovement && (
        <div className="grid grid-cols-2 gap-4">
          {/* Risers */}
          <div className="border border-green-100 rounded-lg overflow-hidden bg-white">
            <div className="bg-green-50 border-b border-green-100 px-4 py-2.5">
              <h3 className="text-sm font-bold text-green-700">▲ Risers ({risers.length})</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {risers.map(m => (
                <div key={m.market.id} className="px-4 py-2.5 hover:bg-green-50 transition-colors">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{m.market.name}</span>
                    <span className="text-xs font-semibold text-green-600 tabular-nums">
                      #{m.currentRank} <span className="text-gray-400">(was #{m.defaultRank})</span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Score: {m.currentScore.toFixed(1)} <span className="text-green-600 font-medium">+{m.scoreChange.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fallers */}
          <div className="border border-red-100 rounded-lg overflow-hidden bg-white">
            <div className="bg-red-50 border-b border-red-100 px-4 py-2.5">
              <h3 className="text-sm font-bold text-red-700">▼ Fallers ({fallers.length})</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {fallers.map(m => (
                <div key={m.market.id} className="px-4 py-2.5 hover:bg-red-50 transition-colors">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{m.market.name}</span>
                    <span className="text-xs font-semibold text-red-600 tabular-nums">
                      #{m.currentRank} <span className="text-gray-400">(was #{m.defaultRank})</span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Score: {m.currentScore.toFixed(1)} <span className="text-red-600 font-medium">{m.scoreChange.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
