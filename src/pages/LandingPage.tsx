import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import { METRICS, PILLARS } from '../data/metrics';

const BRAND = '#3B1F6B';

export default function LandingPage() {
  const navigate = useNavigate();
  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const masterDataDate = useMarketStore(s => s.masterDataDate);
  const _tick = useMarketStore(s => s._lastTick);

  const ranked = useMemo(() => getScoredMarkets(), [markets, _tick]);

  const stats = useMemo(() => {
    const tier1 = ranked.filter(m => m.totalScore >= 80).length;
    const tier2 = ranked.filter(m => m.totalScore >= 60 && m.totalScore < 80).length;
    const tier3 = ranked.filter(m => m.totalScore < 60).length;

    let verified = 0, estimated = 0, proxy = 0, filled = 0;
    for (const m of markets) {
      for (const [idStr, v] of Object.entries(m.values)) {
        if (v === null || v === undefined) continue;
        filled++;
        const st = m.sources[Number(idStr)]?.status;
        if (st === 'VERIFIED') verified++;
        else if (st === 'REGIONAL_PROXY') proxy++;
        else estimated++;
      }
    }
    const total = markets.length * METRICS.length;
    return { tier1, tier2, tier3, verified, estimated, proxy, filled, total };
  }, [markets, ranked]);

  const topFive = ranked.slice(0, 5);

  return (
    <div className="min-h-full bg-gradient-to-b from-white via-purple-50/30 to-white">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-10 pt-12 pb-8 border-b border-purple-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600">
              Brunswick · Industrial Real Estate
            </span>
            {masterDataDate && (
              <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                Data refreshed {masterDataDate}
              </span>
            )}
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-gray-900 leading-[1.05] mb-4">
            Systematic screening of <span style={{ color: BRAND }}>{markets.length}</span> UK<br />
            industrial markets.
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl leading-relaxed">
            A weighted scoring model across <strong className="text-gray-900">{PILLARS.length} pillars</strong> and{' '}
            <strong className="text-gray-900">{METRICS.length} quantitative metrics</strong>, producing a composite
            0–100 score that surfaces investment-grade targets and flags markets to monitor.
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-4 mt-8">
            <HeroStat label="Markets screened" value={String(markets.length)} />
            <HeroStat
              label="Tier 1 — Core"
              value={String(stats.tier1)}
              accent="#15803d"
              sub={`of ${ranked.length} (${ranked.length > 0 ? Math.round(100 * stats.tier1 / ranked.length) : 0}%)`}
            />
            <HeroStat
              label="Verified data points"
              value={stats.verified.toLocaleString('en-GB')}
              sub={`${stats.filled > 0 ? Math.round(100 * stats.verified / stats.filled) : 0}% of filled cells`}
            />
            <HeroStat
              label="Metrics tracked"
              value={String(METRICS.length)}
              sub={`${PILLARS.length} pillars, equally weighted`}
            />
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mt-8">
            <CTA primary onClick={() => navigate('/rankings')}>
              Open Rankings →
            </CTA>
            <CTA onClick={() => navigate('/dashboard')}>Dashboard</CTA>
            <CTA onClick={() => navigate('/map')}>Map</CTA>
            <CTA onClick={() => navigate('/sources')}>Methodology</CTA>
          </div>
        </div>
      </section>

      {/* ─── Framework visualisation ─────────────────────────────────────── */}
      <section className="px-10 py-14 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-600 mb-3">
              The framework
            </div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Six pillars. {METRICS.length} metrics. One score.
            </h2>
            <p className="text-sm text-gray-500 mt-3 max-w-2xl mx-auto leading-relaxed">
              Every UK industrial market is scored 1–5 against every metric. Metric scores aggregate
              to pillar scores; the six pillars — equally weighted by default — combine into a
              composite <strong className="text-gray-800">0–100 rating</strong> that classifies
              each market as Tier 1 (Core), Tier 2 (Value-add) or Tier 3 (Monitor).
            </p>
          </div>

          {/* Pillar grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {PILLARS.map(p => (
              <PillarCard
                key={p.name}
                name={p.name}
                weight={p.totalWeight}
                colour={p.colour}
                metrics={PILLAR_HIGHLIGHTS[p.name] ?? []}
              />
            ))}
          </div>

          {/* Convergence to composite */}
          <div className="mt-12 flex flex-col items-center">
            {/* Downward connector */}
            <svg width="840" height="60" viewBox="0 0 840 60" className="max-w-full opacity-60">
              {PILLARS.map((p, i) => {
                const cx = 70 + i * 140;
                return (
                  <path
                    key={p.name}
                    d={`M ${cx} 0 Q ${cx} 30, 420 55`}
                    stroke={p.colour}
                    strokeWidth={1.25}
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {/* Composite score pill */}
            <div
              className="mt-2 relative flex items-center gap-4 rounded-2xl px-7 py-5 border-2 bg-white shadow-xl"
              style={{ borderColor: BRAND }}
            >
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Brunswick composite
                </div>
                <div className="text-lg font-bold text-gray-800 mt-0.5">Market score</div>
              </div>
              <div
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center text-white font-bold shadow-inner"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #6d28d9 100%)` }}
              >
                <div className="text-[9px] tracking-[0.2em] opacity-80">SCORE</div>
                <div className="text-xl leading-none">0–100</div>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <TierChip score="≥ 80" label="Tier 1" colour="#15803d" bg="#f0fdf4" />
                <TierChip score="60–79" label="Tier 2" colour="#b45309" bg="#fffbeb" />
                <TierChip score="< 60" label="Tier 3" colour="#b91c1c" bg="#fef2f2" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Methodology intro (moved from Data Sources) ─────────────────── */}
      <section className="px-10 py-12 bg-gradient-to-b from-purple-50/40 to-white border-y border-purple-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-600 mb-2">
                Methodology
              </div>
              <h2 className="text-2xl font-bold text-gray-900">How markets are scored</h2>
              <p className="text-sm text-gray-500 mt-1">Scoring approach, tier thresholds, source priority, and status flags.</p>
            </div>
            <button
              onClick={() => navigate('/sources#thresholds')}
              className="text-xs font-semibold px-3 py-2 rounded-lg border transition-colors"
              style={{ borderColor: BRAND, color: BRAND }}
            >
              See per-metric thresholds →
            </button>
          </div>

          {/* Scoring flow */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <FlowStep num="1" title="Score each metric" body="Every metric scored 1–5 vs. its threshold band. Score 5 = best-in-class; 1 = weakest. Missing data is excluded." />
            <FlowStep num="2" title="Aggregate to pillar" body="Pillar score = simple average of its scored metrics (1–5). Missing metrics are redistributed proportionally." />
            <FlowStep num="3" title="Weight to total" body="Pillar scores scale by weight (default: equal across all six) into a composite out of 100." />
            <FlowStep num="4" title="Apply tier cut-offs" body="≥80 Tier 1 (Core) · 60–79 Tier 2 (Value-add) · <60 Tier 3 (Monitor)." />
          </div>

          {/* Source priority + flags */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600 mb-3">
                Source priority hierarchy
              </h3>
              <ol className="space-y-2 text-xs text-gray-700">
                <PriorityRow n={1} label="Government API" desc="NOMIS, ONS, VOA, EA, OSRM → VERIFIED" />
                <PriorityRow n={2} label="Manual entry (primary source)" desc="CoStar, MSCI, broker pitch → ESTIMATED" />
                <PriorityRow n={3} label="PDF / HTML scrape" desc="Broker reports, public tables → ESTIMATED" />
                <PriorityRow n={4} label="Regional proxy" desc="Regional figure cascaded to markets → REGIONAL_PROXY" />
                <PriorityRow n={5} label="Missing" desc="null — excluded from scoring, flagged in Data Entry" />
              </ol>
            </div>
            <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600 mb-3">
                Status flags
              </h3>
              <div className="space-y-2 text-xs">
                <StatusLegend color="#15803d" bg="#f0fdf4" label="VERIFIED" desc="Government API, value within expected range" />
                <StatusLegend color="#b45309" bg="#fffbeb" label="ESTIMATED" desc="Manual entry or PDF/HTML scrape, source cited" />
                <StatusLegend color="#6b7280" bg="#f3f4f6" label="REGIONAL_PROXY" desc="Regional figure cascaded to all markets in region" />
                <StatusLegend color="#b91c1c" bg="#fef2f2" label="REVIEW_NEEDED" desc="Value outside validation bounds — excluded from scoring" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Data quality + top markets ─────────────────────────────────── */}
      <section className="px-10 py-12 bg-purple-50/40 border-y border-purple-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Data provenance */}
          <div className="lg:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600 mb-2">
              Data provenance
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Every number, traceable to source.</h2>
            <p className="text-sm text-gray-600 mb-4">
              Government APIs (NOMIS, ONS, VOA, Environment Agency, OSRM) take priority. Commercial data
              (CoStar, MSCI, broker reports) is manually entered with source and date. Regional figures
              cascade to markets with explicit flagging.
            </p>

            <div className="space-y-2">
              <DataBar label="VERIFIED" count={stats.verified} total={stats.filled} colour="#15803d" bg="#f0fdf4" />
              <DataBar label="ESTIMATED" count={stats.estimated} total={stats.filled} colour="#b45309" bg="#fffbeb" />
              <DataBar label="REGIONAL PROXY" count={stats.proxy} total={stats.filled} colour="#6b7280" bg="#f3f4f6" />
            </div>

            <button
              onClick={() => navigate('/sources')}
              className="mt-4 text-xs font-semibold text-purple-700 hover:text-purple-900 underline"
            >
              See full methodology & source audit →
            </button>
          </div>

          {/* Top 5 markets */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Top 5 — current ranking</div>
                <h3 className="text-sm font-bold text-gray-800">Highest composite scores</h3>
              </div>
              <button
                onClick={() => navigate('/rankings')}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900"
              >
                View all →
              </button>
            </div>
            <table className="w-full">
              <tbody>
                {topFive.map(sm => {
                  const tierColour = sm.totalScore >= 80 ? '#15803d' : sm.totalScore >= 60 ? '#b45309' : '#b91c1c';
                  return (
                    <tr
                      key={sm.market.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-purple-50/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/dashboard?market=${sm.market.id}`)}
                    >
                      <td className="px-5 py-3 w-10 font-mono text-xs text-gray-400">#{sm.rank}</td>
                      <td className="py-3">
                        <div className="font-semibold text-gray-900 text-sm">{sm.market.name}</div>
                        <div className="text-[11px] text-gray-400">{sm.market.region}</div>
                      </td>
                      <td className="py-3 w-48">
                        {/* mini pillar bars */}
                        <div className="flex items-end gap-0.5 h-6">
                          {PILLARS.map(p => {
                            const score = sm.pillarScores[p.name]?.score ?? 0;
                            const h = Math.max(2, (score / 5) * 24);
                            return (
                              <div
                                key={p.name}
                                className="flex-1"
                                style={{ height: `${h}px`, background: p.colour, opacity: score > 0 ? 1 : 0.15 }}
                                title={`${p.name}: ${score.toFixed(1)}`}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right w-20">
                        <span className="text-xl font-bold tabular-nums" style={{ color: tierColour }}>
                          {sm.totalScore.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {topFive.length === 0 && (
                  <tr><td className="px-5 py-6 text-center text-gray-400 text-xs">No markets loaded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Capabilities ─────────────────────────────────────────────── */}
      <section className="px-10 py-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600 mb-2">
              Capabilities
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Screen. Compare. Deep-dive. Track.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Capability
              icon="🏆"
              title="Screen"
              body="Filter all markets by tier, region, or investment thesis. Auto-sort by the dimension that matters."
              onClick={() => navigate('/rankings')}
            />
            <Capability
              icon="⚖️"
              title="Compare"
              body="Side-by-side up to 5 markets across all 60 metrics with best-performer highlights."
              onClick={() => navigate('/rankings')}
            />
            <Capability
              icon="📊"
              title="Deep-dive"
              body="Radar, pillar bars, 60-metric heatmap, and custom portfolio fit analyser."
              onClick={() => navigate('/dashboard')}
            />
            <Capability
              icon="📋"
              title="Track pipeline"
              body="Flag markets as Watchlist, Active, Invested, or Passed. Internal notes per market."
              onClick={() => navigate('/pipeline')}
            />
            <Capability
              icon="🗺️"
              title="Geographic view"
              body="Interactive map with pillar-colour overlays and radius analysis."
              onClick={() => navigate('/map')}
            />
            <Capability
              icon="🎚️"
              title="Sensitivity testing"
              body="Adjust pillar weights live. Save scenarios. See top movers vs default."
              onClick={() => navigate('/sensitivity')}
            />
            <Capability
              icon="📝"
              title="Data entry"
              body="Enter commercial data (CoStar, MSCI, broker) with validation bounds and source tracking."
              onClick={() => navigate('/data-entry')}
            />
            <Capability
              icon="🔗"
              title="Source audit"
              body="Full methodology, per-metric thresholds, and provenance of every number."
              onClick={() => navigate('/sources')}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-10 py-6 border-t border-purple-100 text-center">
        <div className="max-w-6xl mx-auto text-[11px] text-gray-400">
          Brunswick Industrial Screening Framework · {PILLARS.length} pillars · {METRICS.length} metrics · {markets.length} markets
          {masterDataDate && ` · Data: ${masterDataDate}`}
        </div>
      </footer>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function HeroStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-purple-100 shadow-sm px-4 py-3">
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-3xl font-bold mt-0.5 tabular-nums" style={{ color: accent ?? '#1f2937' }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function CTA({
  children, onClick, primary,
}: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
        primary
          ? 'text-white border-transparent hover:shadow-md'
          : 'bg-white text-gray-700 border-gray-200 hover:border-purple-400 hover:text-purple-700'
      }`}
      style={primary ? { background: BRAND } : {}}
    >
      {children}
    </button>
  );
}

function FlowStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="bg-white border border-purple-100 rounded-xl p-4 relative">
      <div
        className="absolute -top-3 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
        style={{ background: BRAND }}
      >
        {num}
      </div>
      <div className="mt-2 font-semibold text-gray-900 text-sm mb-1">{title}</div>
      <div className="text-xs text-gray-500 leading-relaxed">{body}</div>
    </div>
  );
}

function DataBar({ label, count, total, colour, bg }: { label: string; count: number; total: number; colour: string; bg: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-bold uppercase tracking-wider" style={{ color: colour }}>{label}</span>
        <span className="font-mono tabular-nums text-gray-600">
          {count.toLocaleString('en-GB')} <span className="text-gray-400">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: bg }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
      </div>
    </div>
  );
}

function Capability({
  icon, title, body, onClick,
}: { icon: string; title: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-purple-100 shadow-sm p-4 hover:shadow-md hover:border-purple-300 transition-all"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-bold text-gray-900 text-sm mb-1">{title}</div>
      <div className="text-xs text-gray-500 leading-relaxed">{body}</div>
    </button>
  );
}

// ─── Pillar card + convergence helpers ──────────────────────────────────────

function PillarCard({
  name, weight, colour, metrics,
}: { name: string; weight: number; colour: string; metrics: string[] }) {
  return (
    <div
      className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-4 pt-5 hover:shadow-md hover:border-gray-300 transition-all overflow-hidden"
    >
      {/* Top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${colour} 0%, ${colour}80 100%)` }}
      />

      {/* Weight chip */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
          style={{ background: colour + '15', color: colour }}
        >
          {weight}% weight
        </span>
      </div>

      {/* Pillar name */}
      <h3 className="text-sm font-bold text-gray-900 leading-tight mb-3 min-h-[2.5rem]">
        {name}
      </h3>

      {/* Key metric list */}
      <ul className="space-y-1.5 text-[11px] text-gray-600">
        {metrics.slice(0, 4).map(m => (
          <li key={m} className="flex items-start gap-1.5 leading-tight">
            <span
              className="inline-block w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: colour }}
            />
            <span>{m}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TierChip({ score, label, colour, bg }: { score: string; label: string; colour: string; bg: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="font-mono tabular-nums font-bold text-[10px] px-1.5 py-0.5 rounded"
        style={{ background: bg, color: colour }}
      >
        {score}
      </span>
      <span className="font-semibold text-gray-700">{label}</span>
    </div>
  );
}

function PriorityRow({ n, label, desc }: { n: number; label: string; desc: string }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="font-mono text-gray-400 w-4">{n}.</span>
      <div className="flex-1">
        <span className="font-semibold text-gray-800">{label}</span>
        <span className="text-gray-500 ml-1">— {desc}</span>
      </div>
    </li>
  );
}

function StatusLegend({ color, bg, label, desc }: { color: string; bg: string; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="inline-block px-1.5 py-0 rounded text-[9px] font-bold tracking-wide whitespace-nowrap"
        style={{ background: bg, color }}
      >
        {label}
      </span>
      <span className="text-gray-600 flex-1">{desc}</span>
    </div>
  );
}

const PILLAR_HIGHLIGHTS: Record<string, string[]> = {
  'Supply':             ['Vacancy rate', 'Development pipeline', 'Planning approval', 'MLI concentration'],
  'Demand':             ['Take-up growth', 'Net absorption', 'SME density', 'Clustering'],
  'Connectivity':       ['Motorway access', 'Rail / port / airport', 'Drive time to core', 'Grid capacity'],
  'Labour':             ['30- and 60-min catchment', 'Unemployment', 'Wages / cost', 'Workforce mix'],
  'Rents & Yields':     ['Prime rent', 'Rental growth', 'Prime yield', 'Yield spread'],
  'Strategic / Risk':   ['Flood risk', 'Digital infra', 'ESG quality', 'Housing growth'],
};
