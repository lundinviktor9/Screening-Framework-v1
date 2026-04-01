import { METRICS, CONFIG, PILLARS } from '../data/metrics';
import type { MarketInput, ScoredMarket, PillarScore, Pillar, RAG } from '../types';

export function scoreMetric(metricId: number, value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const def = METRICS.find(m => m.id === metricId);
  if (!def) return 0;

  if (def.ruleType === 'Direct') {
    // Direct expert score: clamp to 1–5
    return Math.max(1, Math.min(5, Math.round(value)));
  }

  const { t5, t4, t3, t2 } = def;
  if (t5 === null || t4 === null || t3 === null || t2 === null) return 0;

  if (def.ruleType === 'Lower') {
    if (value <= t5) return 5;
    if (value <= t4) return 4;
    if (value <= t3) return 3;
    if (value <= t2) return 2;
    return 1;
  } else {
    // Higher
    if (value >= t5) return 5;
    if (value >= t4) return 4;
    if (value >= t3) return 3;
    if (value >= t2) return 2;
    return 1;
  }
}

function getRAG(score: number): RAG {
  if (score >= CONFIG.totalGreen) return 'Green';
  if (score >= CONFIG.totalAmber) return 'Amber';
  return 'Red';
}

export function scoreMarket(market: MarketInput): Omit<ScoredMarket, 'rank'> {
  const pillarScores: Record<Pillar, PillarScore> = {} as Record<Pillar, PillarScore>;

  for (const pillarDef of PILLARS) {
    const pillarMetrics = METRICS.filter(m => m.pillar === pillarDef.name);
    const metricScores: Record<number, number> = {};

    for (const metric of pillarMetrics) {
      const raw = market.values[metric.id];
      if (raw !== null && raw !== undefined) {
        metricScores[metric.id] = scoreMetric(metric.id, raw);
      }
    }

    const scored = Object.values(metricScores);
    const avg = scored.length > 0
      ? scored.reduce((a, b) => a + b, 0) / scored.length
      : 0;

    pillarScores[pillarDef.name] = {
      pillar: pillarDef.name,
      score: avg,
      metricScores,
    };
  }

  // Total score: Σ (pillarAvg × pillarWeight)
  const totalScore = PILLARS.reduce((sum, p) => {
    const avg = pillarScores[p.name]?.score ?? 0;
    // avg is on 1–5 scale; weight is in points; convert: (avg/5) * totalWeight
    return sum + (avg / 5) * p.totalWeight;
  }, 0);

  return {
    market,
    pillarScores,
    totalScore: Math.round(totalScore * 10) / 10,
    rag: getRAG(totalScore),
  };
}

export function rankMarkets(markets: MarketInput[]): ScoredMarket[] {
  const scored = markets.map(m => scoreMarket(m));
  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}
