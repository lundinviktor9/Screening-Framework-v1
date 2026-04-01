import { useState, useMemo, useEffect } from 'react';
import { loadMarkets } from '../utils/storage';
import { rankMarkets } from '../utils/scoring';
import type { ScoredMarket, Pillar } from '../types/index';
import { PILLARS } from '../data/metrics';

// ─── Default weights ──────────────────────────────────────────────────────────
const DEFAULT_WEIGHTS = PILLARS.map(p => p.totalWeight); // [20,20,20,15,15,10]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function reScore(market: ScoredMarket, weights: number[]): number {
  const raw = PILLARS.reduce((sum, p, i) => {
    const avg = market.pillarScores[p.name as Pillar]?.score ?? 0;
    return sum + (avg / 5) * weights[i];
  }, 0);
  return Math.round(raw * 10) / 10;
}

/** When pillar `changedIdx` is dragged to `newVal`, redistribute the delta
 *  proportionally across all other pillars, then normalise to sum = 100. */
function adjustWeights(current: number[], changedIdx: number, newVal: number): number[] {
  const clamped = Math.max(0, Math.min(100, newVal));
  const delta = clamped - current[changedIdx];
  if (Math.abs(delta) < 0.001) return current;

  const othersSum = current.reduce((s, v, i) => (i === changedIdx ? s : s + v), 0);

  const next = current.map((v, i) => {
    if (i === changedIdx) return clamped;
    if (othersSum === 0) return 0;
    return Math.max(0, v - delta * (v / othersSum));
  });

  const sum = next.reduce((a, b) => a + b, 0);
  return sum === 0 ? current : next.map(v => (v / sum) * 100);
}

function tierColor(score: number) {
  if (score >= 80) return { text: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
  if (score >= 60) return { text: '#b45309', bg: '#fffbeb', border: '#fde68a' };
  return { text: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
}

// ─── Pillar slider ─────────────────────────────────────────────────────────────
interface SliderProps {
  index: number;
  name: string;
  colour: string;
  value: number;
  onChange: (idx: number, val: number) => void;
}

function PillarSlider({ index, name, colour, value, onChange }: SliderProps) {
  const pct = Math.round(value * 10) / 10;
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: colour }}
          />
          <span className="text-xs font-medium text-gray-700 truncate">{name}</span>
        </div>
        <span
          className="text-xs font-bold tabular-nums flex-shrink-0 ml-1"
          style={{ color: colour }}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={value}
        onChange={e => onChange(index, Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: colour,
          background: `linear-gradient(to right, ${colour} ${pct}%, #e5e7eb ${pct}%)`,
        }}
      />
    </div>
  );
}

// ─── Rank-change badge ─────────────────────────────────────────────────────────
function RankChange({ change }: { change: number }) {
  if (change === 0) {
    return <span className="text-gray-300 font-medium tabular-nums text-xs">—</span>;
  }
  if (change > 0) {
    return (
      <span className="flex items-center gap-0.5 text-green-600 font-semibold text-xs tabular-nums">
        ▲{change}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-red-500 font-semibold text-xs tabular-nums">
      ▼{Math.abs(change)}
    </span>
  );
}

// ─── Stacked pillar contribution bar ──────────────────────────────────────────
function PillarBar({ market, weights }: { market: ScoredMarket; weights: number[] }) {
  const segments = PILLARS.map((p, i) => {
    const avg = market.pillarScores[p.name as Pillar]?.score ?? 0;
    return { colour: p.colour, contribution: (avg / 5) * weights[i] };
  });
  const total = segments.reduce((s, seg) => s + seg.contribution, 0);
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-100">
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{
            width: total > 0 ? `${(seg.contribution / total) * 100}%` : `${100 / PILLARS.length}%`,
            background: seg.colour,
          }}
        />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SensitivityPage() {
  const [baseRanked, setBaseRanked] = useState<ScoredMarket[]>([]);
  const [weights, setWeights] = useState<number[]>(DEFAULT_WEIGHTS);

  useEffect(() => {
    setBaseRanked(rankMarkets(loadMarkets()));
  }, []);

  const sensitiveRanked = useMemo(() => {
    const scored = baseRanked.map(m => ({
      ...m,
      sensitiveScore: reScore(m, weights),
    }));
    scored.sort((a, b) => b.sensitiveScore - a.sensitiveScore);
    return scored.map((m, i) => ({ ...m, sensitiveRank: i + 1 }));
  }, [baseRanked, weights]);

  const isDefault = weights.every((w, i) => Math.abs(w - DEFAULT_WEIGHTS[i]) < 0.01);
  const moversCount = sensitiveRanked.filter(m => m.sensitiveRank !== m.rank).length;

  function handleSliderChange(idx: number, val: number) {
    setWeights(prev => adjustWeights(prev, idx, val));
  }

  function handleReset() {
    setWeights([...DEFAULT_WEIGHTS]);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Sensitivity Analysis</h1>
          <p className="text-xs text-gray-400">
            Adjust pillar weights to see how rankings change · weights always sum to 100%
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isDefault && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
              {moversCount} market{moversCount !== 1 ? 's' : ''} moved
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={isDefault}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* ── Sliders panel ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
          {PILLARS.map((p, i) => (
            <PillarSlider
              key={p.name}
              index={i}
              name={p.name}
              colour={p.colour}
              value={weights[i]}
              onChange={handleSliderChange}
            />
          ))}
        </div>

        {/* Weight summary chips */}
        <div className="flex gap-2 flex-wrap mt-3">
          {PILLARS.map((p, i) => (
            <div
              key={p.name}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
              style={{
                color: p.colour,
                borderColor: `${p.colour}40`,
                background: `${p.colour}10`,
              }}
            >
              <span>{p.name}</span>
              <span className="font-bold tabular-nums">{Math.round(weights[i] * 10) / 10}%</span>
              {!isDefault && Math.abs(weights[i] - DEFAULT_WEIGHTS[i]) > 0.05 && (
                <span className="opacity-60">
                  ({weights[i] > DEFAULT_WEIGHTS[i] ? '+' : ''}{(weights[i] - DEFAULT_WEIGHTS[i]).toFixed(1)})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Rankings table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-10">#</th>
              <th className="text-left px-2 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-14">Change</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Market</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Region</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-24">Score</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell w-20">Default</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell w-40">Pillar split</th>
            </tr>
          </thead>
          <tbody>
            {sensitiveRanked.map((m) => {
              const change = m.rank - m.sensitiveRank; // positive = moved up
              const tc = tierColor(m.sensitiveScore);
              const defaultTc = tierColor(m.totalScore);
              const rowHighlight = !isDefault && change !== 0;
              return (
                <tr
                  key={m.market.id}
                  className={`border-b border-gray-50 transition-colors ${rowHighlight ? 'hover:bg-gray-50' : 'hover:bg-gray-50'}`}
                >
                  {/* Rank */}
                  <td className="px-4 py-2.5 text-sm font-bold text-gray-500 tabular-nums">
                    {m.sensitiveRank}
                  </td>

                  {/* Change */}
                  <td className="px-2 py-2.5 text-center">
                    <RankChange change={change} />
                  </td>

                  {/* Market name */}
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-gray-900">{m.market.name}</span>
                  </td>

                  {/* Region */}
                  <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell">
                    {m.market.region}
                  </td>

                  {/* Sensitive score */}
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className="inline-block text-sm font-bold tabular-nums px-2 py-0.5 rounded-full"
                      style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}
                    >
                      {m.sensitiveScore}
                    </span>
                  </td>

                  {/* Default score (faded) */}
                  <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                    <span
                      className="text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full"
                      style={{ background: defaultTc.bg, color: defaultTc.text, opacity: 0.65 }}
                    >
                      {m.totalScore}
                    </span>
                  </td>

                  {/* Pillar split bar */}
                  <td className="px-4 py-2.5 hidden lg:table-cell">
                    <PillarBar market={m} weights={weights} />
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
