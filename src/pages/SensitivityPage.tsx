import { useMarketStore } from '../store/marketStore';
import type { Pillar } from '../types/index';
import { PILLARS } from '../data/metrics';
import { MetricSensitivity } from '../components/sensitivity/MetricSensitivity';
import { BiggestMovers } from '../components/sensitivity/BiggestMovers';
import { ScenarioManager } from '../components/sensitivity/ScenarioManager';

// ─── Default weights ──────────────────────────────────────────────────────────
const DEFAULT_WEIGHTS = [17, 17, 17, 17, 16, 16];

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


// ─── Main page ────────────────────────────────────────────────────────────────
export default function SensitivityPage() {
  const currentScenario = useMarketStore(s => s.currentScenario);
  const updatePillarWeights = useMarketStore(s => s.updatePillarWeights);
  const resetToDefault = useMarketStore(s => s.resetToDefault);

  const weights = PILLARS.map(p => currentScenario.pillarWeights[p.name as Pillar] ?? p.totalWeight);
  const isDefault = weights.every((w, i) => Math.abs(w - DEFAULT_WEIGHTS[i]) < 0.01);

  function handleSliderChange(idx: number, val: number) {
    updatePillarWeights(PILLARS[idx].name as Pillar, val);
  }

  function handleReset() {
    resetToDefault();
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
          <button
            onClick={handleReset}
            disabled={isDefault}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* ── Scenario manager ── */}
      <ScenarioManager />

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

      {/* ── Metric sensitivity + biggest movers ── */}
      <div className="flex-1 overflow-y-auto bg-white border-b border-gray-100 px-6 py-4 space-y-6">
        <MetricSensitivity />
        <BiggestMovers />
      </div>
    </div>
  );
}
