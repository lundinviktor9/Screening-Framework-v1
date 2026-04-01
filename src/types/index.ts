export type Pillar =
  | 'Supply'
  | 'Demand'
  | 'Connectivity'
  | 'Labour'
  | 'Rents & Yields'
  | 'Strategic / Risk';

export type RuleType = 'Higher' | 'Lower' | 'Direct';

export type RAG = 'Green' | 'Amber' | 'Red';

export interface MetricDef {
  id: number;           // 1–60
  pillar: Pillar;
  name: string;
  unit: string;
  ruleType: RuleType;
  weight: number;       // points contributed to 100-pt total
  // Thresholds: score 5 → score 2 boundary values
  t5: number | null;    // null for Direct metrics
  t4: number | null;
  t3: number | null;
  t2: number | null;
  inputGuidance: string;
}

export interface MetricSource {
  sourceName: string;
  sourceUrl: string;
  dataDate: string;
}

export interface MarketInput {
  id: string;            // uuid
  name: string;
  region: string;
  notes: string;
  isPreFilled?: boolean; // true = seeded from public data sources
  // metricId → raw value (number) or direct score (1–5)
  values: Record<number, number | null>;
  // metricId → source info
  sources: Record<number, MetricSource>;
  createdAt: string;
  updatedAt: string;
}

export interface PillarScore {
  pillar: Pillar;
  score: number;        // avg of metric scores in pillar (1–5 scale)
  metricScores: Record<number, number>; // metricId → 1–5
}

export interface ScoredMarket {
  market: MarketInput;
  pillarScores: Record<Pillar, PillarScore>;
  totalScore: number;   // 0–100
  rank: number;
  rag: RAG;
}
