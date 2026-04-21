import { useState, useMemo } from 'react';
import { useMarketStore } from '../store/marketStore';
import type { ScoredMarket, Pillar } from '../types/index';
import { PILLARS } from '../data/metrics';

// ─── Default weights ──────────────────────────────────────────────────────────
const DEFAULT_WEIGHTS = PILLARS.map(p => p.totalWeight); // [20,20,20,15,15,10]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function reScore(market: ScoredMarket, weights: number[]): number {
  // Only include pillars that have scored metrics; redistribute weight from empty ones
  const active = PILLARS.map((p, i) => ({
    pillar: p,
    idx: i,
    ps: market.pillarScores[p.name as Pillar],
  })).filter(a => (a.ps?.scoredCount ?? 0) > 0);

  const activeWeightSum = active.reduce((s, a) => s + weights[a.idx], 0);
  if (activeWeightSum === 0) return 0;

  const raw = active.reduce((sum, a) => {
    const avg = a.ps?.score ?? 0;
    const adjustedWeight = (weights[a.idx] / activeWeightSum) * 100;
    return sum + (avg / 5) * adjustedWeight;
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

// ─── Preset scenarios ────────────────────────────────────────────────────────
const PRESET_SCENARIOS: Record<string, number[]> = {
  'Equal (default)':   [17, 17, 17, 17, 16, 16],  // all pillars equally weighted
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SensitivityPage() {
  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const scenarios = useMarketStore(s => s.scenarios);
  const saveScenario = useMarketStore(s => s.saveScenario);
  const deleteScenario = useMarketStore(s => s.deleteScenario);
  const _tick = useMarketStore(s => s._lastTick);

  const baseRanked = useMemo(() => getScoredMarkets(), [markets, _tick]);
  const [weights, setWeights] = useState<number[]>(DEFAULT_WEIGHTS);
  const [activePreset, setActivePreset] = useState<string>('Equal (default)');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');

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

  // Top movers (biggest absolute rank change)
  const topMovers = useMemo(() => {
    return [...sensitiveRanked]
      .map(m => ({ ...m, absChange: Math.abs(m.rank - m.sensitiveRank) }))
      .filter(m => m.absChange > 0)
      .sort((a, b) => b.absChange - a.absChange)
      .slice(0, 5);
  }, [sensitiveRanked]);

  function handleSliderChange(idx: number, val: number) {
    setWeights(prev => adjustWeights(prev, idx, val));
    setActivePreset(''); // user-customised
  }

  function handleReset() {
    setWeights([...DEFAULT_WEIGHTS]);
    setActivePreset('Equal (default)');
  }

  function loadPreset(name: string, presetWeights: number[]) {
    setWeights([...presetWeights]);
    setActivePreset(name);
  }

  function handleSaveScenario() {
    const name = newScenarioName.trim();
    if (!name) return;
    saveScenario(name, weights);
    setShowSaveDialog(false);
    setNewScenarioName('');
    setActivePreset(name);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Sensitivity Analysis</h1>
          <p className="text-xs text-gray-400">
            Adjust pillar weights to see how rankings change · weights always sum to 100%
            {activePreset && <span className="ml-2 text-purple-600 font-medium">Scenario: {activePreset}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isDefault && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
              {moversCount} market{moversCount !== 1 ? 's' : ''} moved
            </span>
          )}
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={isDefault}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#3B1F6B' }}
          >
            Save as scenario
          </button>
          <button
            onClick={handleReset}
            disabled={isDefault}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* ── Scenarios bar ── */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Presets:</span>
          {Object.entries(PRESET_SCENARIOS).map(([name, w]) => (
            <button
              key={name}
              onClick={() => loadPreset(name, w)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                activePreset === name ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              style={activePreset === name ? { background: '#3B1F6B' } : {}}
            >
              {name}
            </button>
          ))}
          {scenarios.length > 0 && (
            <>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide ml-3">Saved:</span>
              {scenarios.map(s => (
                <div key={s.name} className="flex items-center gap-0.5">
                  <button
                    onClick={() => loadPreset(s.name, s.weights)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      activePreset === s.name ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    style={activePreset === s.name ? { background: '#7C3AED' } : {}}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete scenario "${s.name}"?`)) deleteScenario(s.name); }}
                    className="text-xs text-gray-300 hover:text-red-500 px-1"
                    title="Delete scenario"
                  >
                    ×
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {showSaveDialog && (
          <div className="mt-3 flex items-center gap-2 bg-white border border-purple-200 rounded-lg p-2">
            <input
              autoFocus
              type="text"
              value={newScenarioName}
              onChange={e => setNewScenarioName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveScenario(); if (e.key === 'Escape') setShowSaveDialog(false); }}
              placeholder="Scenario name (e.g. 'Q1 2026 strategy')"
              className="flex-1 border-0 px-2 py-1 text-sm focus:outline-none"
            />
            <button
              onClick={handleSaveScenario}
              disabled={!newScenarioName.trim()}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: '#3B1F6B' }}
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-3 py-1 rounded-lg text-xs font-medium text-gray-500"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Top movers banner ── */}
      {!isDefault && topMovers.length > 0 && (
        <div className="flex-shrink-0 bg-purple-50 border-b border-purple-200 px-6 py-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Top movers:</span>
            {topMovers.map(m => {
              const change = m.rank - m.sensitiveRank;
              const up = change > 0;
              return (
                <span key={m.market.id} className="inline-flex items-center gap-1.5 bg-white border border-purple-200 rounded-full px-2.5 py-1 text-xs">
                  <span className="font-medium text-gray-800">{m.market.name}</span>
                  <span className={`font-bold ${up ? 'text-green-600' : 'text-red-500'}`}>
                    {up ? '▲' : '▼'}{Math.abs(change)}
                  </span>
                  <span className="text-gray-400 tabular-nums">#{m.rank} → #{m.sensitiveRank}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

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
