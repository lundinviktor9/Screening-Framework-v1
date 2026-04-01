import { useNavigate } from 'react-router-dom';
import type { ScoredMarket } from '../../types';
import { PILLARS } from '../../data/metrics';

interface Props {
  market: ScoredMarket | null;
  totalCount: number;
  onClose: () => void;
}

const TIER_STYLE = {
  Green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', label: 'Tier 1 — Core' },
  Amber:  { bg: '#fffbeb', border: '#fde68a', text: '#b45309', label: 'Tier 2 — Value-add' },
  Red:    { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', label: 'Tier 3 — Monitor' },
};

function pillarBarColor(score: number): string {
  if (score >= 3.5) return '#22c55e';
  if (score >= 2.5) return '#f59e0b';
  return '#ef4444';
}

export default function MarketProfilePanel({ market, totalCount, onClose }: Props) {
  const navigate = useNavigate();

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 select-none px-6 text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <p className="text-sm font-medium">Click a market on the map</p>
        <p className="text-xs mt-1">to see its headline profile here</p>
      </div>
    );
  }

  const tier = TIER_STYLE[market.rag];
  const pillarEntries = PILLARS.map(p => ({
    name: p.name,
    score: market.pillarScores[p.name]?.score ?? 0,
  }));

  // Top 3 and bottom 3 by metric score
  const metricEntries = Object.entries(market.pillarScores).flatMap(([, ps]) =>
    Object.entries(ps.metricScores).map(([id, score]) => ({ id: Number(id), score })),
  );
  metricEntries.sort((a, b) => b.score - a.score);
  const top3 = metricEntries.slice(0, 3).filter(m => m.score > 0);
  const bot3 = [...metricEntries].reverse().slice(0, 3).filter(m => m.score > 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900 leading-snug">{market.market.name}</h2>
          <span className="inline-block text-xs font-medium px-2 py-0.5 mt-1 rounded-full bg-gray-100 text-gray-600">
            {market.market.region}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5 ml-3 flex-shrink-0"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Score card */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div
          className="rounded-xl px-5 py-3 flex-shrink-0 text-center"
          style={{ background: tier.bg, border: `1px solid ${tier.border}` }}
        >
          <div className="text-3xl font-extrabold" style={{ color: tier.text }}>
            {market.totalScore}
          </div>
          <div className="text-xs font-medium mt-0.5" style={{ color: tier.text }}>/ 100</div>
        </div>
        <div>
          <div
            className="text-xs font-bold px-2 py-0.5 rounded-full mb-1"
            style={{ background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}
          >
            {tier.label}
          </div>
          <div className="text-xs text-gray-500">
            Rank <span className="font-bold text-gray-800">#{market.rank}</span> of {totalCount}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {market.market.isPreFilled ? 'Pre-filled dataset' : 'Custom market'}
          </div>
        </div>
      </div>

      {/* Pillar bars */}
      <div className="px-5 pb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pillars</p>
        <div className="space-y-2">
          {pillarEntries.map(({ name, score }) => {
            const pct = Math.min(100, (score / 5) * 100);
            const color = pillarBarColor(score);
            return (
              <div key={name}>
                <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                  <span className="font-medium truncate">{name}</span>
                  <span className="font-bold ml-2 tabular-nums">{score.toFixed(1)}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths / gaps */}
      {(top3.length > 0 || bot3.length > 0) && (
        <div className="px-5 pb-3 grid grid-cols-2 gap-3">
          {top3.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">▲ Strengths</p>
              {top3.map(m => (
                <div key={m.id} className="text-xs text-gray-600 truncate flex items-center gap-1">
                  <span className="font-bold text-green-600 tabular-nums">{m.score}</span>
                  <span>M{m.id}</span>
                </div>
              ))}
            </div>
          )}
          {bot3.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1">▼ Gaps</p>
              {bot3.map(m => (
                <div key={m.id} className="text-xs text-gray-600 truncate flex items-center gap-1">
                  <span className="font-bold text-red-500 tabular-nums">{m.score}</span>
                  <span>M{m.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {market.market.notes && (
        <div className="px-5 pb-3">
          <p className="text-xs text-gray-400 italic line-clamp-3">{market.market.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto px-5 pb-5 pt-3 border-t border-gray-100 flex flex-col gap-2">
        <button
          onClick={() => navigate(`/dashboard?market=${market.market.id}`)}
          className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#3B1F6B' }}
        >
          Open in Dashboard
        </button>
        <button
          onClick={() => navigate(`/edit/${market.market.id}`)}
          className="w-full py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Edit Market
        </button>
      </div>
    </div>
  );
}
