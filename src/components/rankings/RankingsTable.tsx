import { useNavigate } from 'react-router-dom';
import type { ScoredMarket } from '../../types';
import { PILLARS } from '../../data/metrics';
import RAGBadge from './RAGBadge';
import CompletenessBadge from './CompletenessBadge';
import { computeCompleteness } from '../../utils/dataMerger';

import type { PillarScore } from '../../types';

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
}

export default function RankingsTable({ markets, onDelete }: Props) {
  const navigate = useNavigate();

  if (markets.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        No markets yet. Add your first market to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-purple-100 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#3B1F6B' }} className="text-white">
            <th className="px-3 py-3 text-left font-semibold w-10">#</th>
            <th className="px-3 py-3 text-left font-semibold">Market</th>
            <th className="px-3 py-3 text-left font-semibold">Region</th>
            <th className="px-3 py-3 text-left font-semibold text-xs">Data</th>
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
          {markets.map((sm, i) => (
            <tr
              key={sm.market.id}
              className={`border-t border-purple-50 hover:bg-purple-50 cursor-pointer transition-colors ${
                i % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'
              }`}
              onClick={() => navigate(`/dashboard?market=${sm.market.id}`)}
            >
              <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{sm.rank}</td>
              <td className="px-3 py-2.5 font-semibold text-gray-900">{sm.market.name}</td>
              <td className="px-3 py-2.5 text-gray-500">{sm.market.region}</td>
              <td className="px-3 py-2.5">
                {(() => {
                  const c = computeCompleteness(sm.market);
                  return <CompletenessBadge filled={c.filled} total={c.total} />;
                })()}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
