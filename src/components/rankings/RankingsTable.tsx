import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScoredMarket, PillarScore, Pillar } from '../../types';
import { PILLARS, METRICS } from '../../data/metrics';
import { formatCompact } from '../../utils/formatting';
import RAGBadge from './RAGBadge';
import CompletenessBadge from './CompletenessBadge';
import PillarSparkline from './PillarSparkline';
import RankMovement from './RankMovement';
import { computeCompleteness } from '../../utils/dataMerger';

function pillarCell(ps: PillarScore | undefined, key: string) {
  const score = ps?.score ?? 0;
  const count = ps?.scoredCount ?? 0;
  const total = ps?.totalCount ?? 0;
  const pct = score / 5;
  let bg = 'bg-gray-50 text-gray-400';
  if (count > 0) {
    bg = 'bg-red-50 text-red-700';
    if (pct >= 0.8) bg = 'bg-green-50 text-green-700';
    else if (pct >= 0.6) bg = 'bg-amber-50 text-amber-700';
  }
  return (
    <td key={key} className={`px-3 py-2 text-center ${bg}`}>
      {count > 0 ? (
        <>
          <div className="text-sm font-medium">{score.toFixed(1)}</div>
          <div className="text-[10px] opacity-60">{count}/{total}</div>
        </>
      ) : (
        <div className="text-xs">--</div>
      )}
    </td>
  );
}

interface Props {
  markets: ScoredMarket[];
  onDelete?: (id: string) => void;
  compareMode?: boolean;
  compareIds?: Set<string>;
  onToggleCompare?: (id: string) => void;
  previousRanks?: Record<string, number>;
}

export default function RankingsTable({
  markets, onDelete, compareMode, compareIds, onToggleCompare, previousRanks,
}: Props) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (markets.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        No markets match the current filters.
      </div>
    );
  }

  const colCount = 10 + PILLARS.length + (compareMode ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-purple-100 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#3B1F6B' }} className="text-white">
            {compareMode && <th className="px-2 py-3 w-8"></th>}
            <th className="px-2 py-3 w-6"></th>
            <th className="px-3 py-3 text-left font-semibold w-10">#</th>
            <th className="px-2 py-3 text-center font-semibold text-xs w-12">Δ</th>
            <th className="px-3 py-3 text-left font-semibold">Market</th>
            <th className="px-3 py-3 text-left font-semibold">Region</th>
            <th className="px-3 py-3 text-left font-semibold text-xs">Data</th>
            <th className="px-3 py-3 text-left font-semibold text-xs w-32">Balance</th>
            <th className="px-4 py-3 text-center font-semibold">Total</th>
            {PILLARS.map(p => (
              <th key={p.name} className="px-3 py-3 text-center font-semibold text-xs whitespace-nowrap">
                {p.name.split(' ')[0]}
              </th>
            ))}
            <th className="px-3 py-3 text-center font-semibold">RAG</th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {markets.map((sm, i) => {
            const prevRank = previousRanks?.[sm.market.id];
            const isCompared = compareIds?.has(sm.market.id) ?? false;
            const isExpanded = expandedId === sm.market.id;
            return (
              <Fragment key={sm.market.id}>
                <tr
                  className={`border-t border-purple-50 hover:bg-purple-50 cursor-pointer transition-colors ${
                    isCompared ? 'bg-purple-50' : i % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'
                  } ${isExpanded ? 'bg-purple-50/70' : ''}`}
                  onClick={() => {
                    if (compareMode && onToggleCompare) {
                      onToggleCompare(sm.market.id);
                    } else {
                      navigate(`/dashboard?market=${sm.market.id}`);
                    }
                  }}
                >
                  {compareMode && (
                    <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onChange={() => onToggleCompare?.(sm.market.id)}
                        disabled={!isCompared && (compareIds?.size ?? 0) >= 5}
                        className="accent-purple-600 w-4 h-4"
                      />
                    </td>
                  )}
                  <td
                    className="px-2 py-2.5 text-center"
                    onClick={e => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : sm.market.id);
                    }}
                    title={isExpanded ? 'Hide pillar breakdown' : 'Show pillar breakdown'}
                  >
                    <span className={`inline-block text-xs transition-transform text-gray-400 hover:text-purple-600 ${isExpanded ? 'rotate-90 text-purple-600' : ''}`}>
                      ▶
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{sm.rank}</td>
                  <td className="px-2 py-2.5 text-center">
                    <RankMovement currentRank={sm.rank} previousRank={prevRank} />
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900">{sm.market.name}</td>
                  <td className="px-3 py-2.5 text-gray-500">{sm.market.region}</td>
                  <td className="px-3 py-2.5">
                    {(() => {
                      const c = computeCompleteness(sm.market);
                      return <CompletenessBadge filled={c.filled} total={c.total} />;
                    })()}
                  </td>
                  <td className="px-3 py-2.5">
                    <PillarSparkline pillarScores={sm.pillarScores} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className="font-bold text-base"
                      style={{ color: sm.rag === 'Green' ? '#15803d' : sm.rag === 'Amber' ? '#b45309' : '#b91c1c' }}
                    >
                      {sm.totalScore.toFixed(1)}
                    </span>
                  </td>
                  {PILLARS.map(p => pillarCell(sm.pillarScores[p.name], `${sm.market.id}-${p.name}`))}
                  <td className="px-3 py-2.5 text-center">
                    <RAGBadge rag={sm.rag} />
                  </td>
                  <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => window.open(`/market/${sm.market.id}/print`, '_blank')}
                        className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-50 border border-gray-200"
                        title="Open printable one-pager"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => navigate(`/edit/${sm.market.id}`)}
                        className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-50 border border-purple-200"
                      >
                        Edit
                      </button>
                      {onDelete && !sm.market.id.startsWith('sample-') && (
                        <button
                          onClick={() => onDelete(sm.market.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 border border-red-200"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-purple-50/30">
                    <td colSpan={colCount} className="px-6 py-4 border-t border-purple-100">
                      <PillarBreakdown market={sm} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pillar breakdown drill-down ──────────────────────────────────────────────

function PillarBreakdown({ market }: { market: ScoredMarket }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {PILLARS.map(p => (
        <PillarMetricList key={p.name} market={market} pillarName={p.name} colour={p.colour} />
      ))}
    </div>
  );
}

function PillarMetricList({
  market, pillarName, colour,
}: { market: ScoredMarket; pillarName: Pillar; colour: string }) {
  const ps = market.pillarScores[pillarName];
  const pillarMetrics = METRICS.filter(m => m.pillar === pillarName);

  const rows = pillarMetrics.map(m => ({
    metric: m,
    value: market.market.values[m.id],
    score: ps?.metricScores[m.id] ?? 0,
  }));

  const scoredRows = rows.filter(r => r.score > 0);
  const avgScore = scoredRows.length > 0
    ? scoredRows.reduce((s, r) => s + r.score, 0) / scoredRows.length
    : 0;

  function scoreClass(s: number): string {
    if (s === 0) return 'text-gray-300';
    if (s >= 4) return 'text-green-600';
    if (s >= 3) return 'text-amber-600';
    return 'text-red-500';
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: colour + '40' }}>
      <div
        className="px-3 py-2 flex items-center justify-between text-xs font-semibold text-white"
        style={{ background: colour }}
      >
        <span>{pillarName}</span>
        <span className="tabular-nums font-mono">
          {scoredRows.length > 0 ? avgScore.toFixed(2) : '—'}
          <span className="opacity-70 text-[10px] ml-1">/ 5</span>
        </span>
      </div>
      <table className="w-full">
        <tbody>
          {rows.map(({ metric, value, score }) => {
            const hasData = value !== null && value !== undefined;
            return (
              <tr key={metric.id} className="border-b border-gray-50 last:border-0">
                <td className="px-2 py-1 text-[11px] text-gray-600 font-mono w-9">M{metric.id}</td>
                <td className="px-1 py-1 text-[11px] text-gray-700 truncate" title={metric.name}>
                  {metric.name}
                </td>
                <td className="px-2 py-1 text-right text-[11px] font-mono text-gray-600 tabular-nums whitespace-nowrap" title={metric.unit}>
                  {hasData ? formatCompact(value, metric.unit) : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums w-8 ${scoreClass(score)}`}>
                  {score > 0 ? score : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
