import { create } from 'zustand';
import type { MarketInput, MetricSource, MetricStatusFlag, PipelineStatus } from '../types';
import { UK_MARKETS } from '../data/ukMarkets';
import { rankMarkets } from '../utils/scoring';
import type { ScoredMarket } from '../types';
import { mergeMasterData, type MasterData } from '../utils/dataMerger';

// ─── Sensitivity scenarios ────────────────────────────────────────────────────
const SCENARIOS_KEY = 'sf_saved_scenarios';
export interface SavedScenario { name: string; weights: number[]; savedAt: string; }
function readScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writeScenarios(s: SavedScenario[]) {
  localStorage.setItem(SCENARIOS_KEY, JSON.stringify(s));
}

// ─── Rank history (for "vs last refresh" indicator) ───────────────────────────
const RANK_HISTORY_KEY = 'sf_rank_history';
export interface RankHistory {
  snapshotDate: string;       // when the snapshot was taken
  masterDataDate: string | null;
  ranks: Record<string, number>; // marketId -> rank at snapshot
}
function readRankHistory(): RankHistory | null {
  try {
    const raw = localStorage.getItem(RANK_HISTORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeRankHistory(h: RankHistory) {
  localStorage.setItem(RANK_HISTORY_KEY, JSON.stringify(h));
}

// ─── Portfolio assets ─────────────────────────────────────────────────────────
const PORTFOLIO_KEY = 'sf_portfolio_assets';
export interface PortfolioAsset {
  id: string;
  name: string;
  lat: number;
  lng: number;
  marketId?: string;     // nearest market (auto-linked)
  assetType?: string;    // e.g. "Warehouse", "Logistics park"
  sizeSqft?: number;
  notes?: string;
  addedAt: string;
}
function readPortfolio(): PortfolioAsset[] {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writePortfolio(a: PortfolioAsset[]) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(a));
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sf_markets_v2';
const VERSION_KEY = 'sf_data_version';
const CURRENT_VERSION = 5; // v5: M41/M42 redefined £psf (Newmark) + M65-M72 added

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFromStorage(): MarketInput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...UK_MARKETS];
    const parsed: MarketInput[] = JSON.parse(raw);
    return parsed.length > 0 ? parsed : [...UK_MARKETS];
  } catch {
    return [...UK_MARKETS];
  }
}

function writeToStorage(markets: MarketInput[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(markets));
}

/** One-time migration: assign status flags to legacy sources that lack them,
 *  and drop removed markets (uk-76 Belfast in v4). */
function migrateStatuses(markets: MarketInput[]): MarketInput[] {
  const version = Number(localStorage.getItem(VERSION_KEY) || '0');
  if (version >= CURRENT_VERSION) return markets;

  let migrated = markets.map(m => {
    const sources = { ...m.sources };
    for (const key of Object.keys(sources)) {
      const id = Number(key);
      const src = sources[id];
      if (src && !src.status) {
        sources[id] = {
          ...src,
          status: m.isPreFilled ? 'VERIFIED' as MetricStatusFlag : 'ESTIMATED' as MetricStatusFlag,
          geographicLevel: src.geographicLevel ?? 'market',
          confidence: m.isPreFilled ? 'primary_source' : 'estimated',
        };
      }
    }
    return { ...m, sources };
  });

  // v4: Belfast dropped from the matrix (VOA + NOMIS BRES gaps make it unreliable)
  migrated = migrated.filter(m => m.id !== 'uk-76');

  // v5: M41/M42 redefined (index → £psf, Newmark source). Clear legacy index
  // values so the new Newmark-sourced values flow in cleanly via master_data.json.
  if (version < 5) {
    migrated = migrated.map(m => {
      const values = { ...m.values };
      const sources = { ...m.sources };
      for (const id of [41, 42]) {
        const v = values[id];
        // Only clear if the legacy index value (50-250 range); preserve real £psf values
        if (typeof v === 'number' && v > 30) {
          values[id] = null;
          delete sources[id];
        }
      }
      return { ...m, values, sources };
    });
  }

  localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
  writeToStorage(migrated);
  return migrated;
}

/** Return a copy of markets with REVIEW_NEEDED values nullified for scoring. */
function toScorable(markets: MarketInput[]): MarketInput[] {
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
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface MarketStore {
  markets: MarketInput[];
  masterDataDate: string | null; // generated_at from master_data.json
  _lastTick: number; // forces re-render on mutation

  // Derived (call these, don't subscribe)
  getScoredMarkets: () => ScoredMarket[];

  // Actions
  reload: () => void;
  loadMasterData: () => Promise<void>;
  saveAll: (markets: MarketInput[]) => void;
  addMarket: (market: MarketInput) => void;
  updateMarket: (market: MarketInput) => void;
  deleteMarket: (id: string) => void;
  resetToDefaults: () => void;

  /** Update a single metric value + source metadata for one market. */
  updateMetricValue: (
    marketId: string,
    metricId: number,
    value: number | null,
    source: MetricSource,
  ) => void;

  /** Cascade a regional proxy value to all markets in the same region. */
  cascadeRegionalProxy: (
    originMarketId: string,
    region: string,
    metricId: number,
    value: number | null,
    source: Omit<MetricSource, 'status' | 'geographicLevel' | 'confidence' | 'regionalSourceMarketId'>,
  ) => void;

  /** Set pipeline status + notes for a market */
  setPipelineStatus: (marketId: string, status: PipelineStatus, notes?: string) => void;

  // ─── Sensitivity scenarios ───
  scenarios: SavedScenario[];
  saveScenario: (name: string, weights: number[]) => void;
  deleteScenario: (name: string) => void;

  // ─── Rank history ───
  previousRanks: Record<string, number>; // marketId -> previous rank
  snapshotRanks: () => void; // take current ranks → previousRanks

  // ─── Portfolio assets ───
  portfolioAssets: PortfolioAsset[];
  addPortfolioAsset: (a: Omit<PortfolioAsset, 'id' | 'addedAt'>) => void;
  updatePortfolioAsset: (id: string, patch: Partial<PortfolioAsset>) => void;
  deletePortfolioAsset: (id: string) => void;
  clearPortfolio: () => void;
}

export const useMarketStore = create<MarketStore>((set, get) => {
  // Initialise from localStorage with migration
  const initial = migrateStatuses(readFromStorage());

  // Kick off async master_data.json load immediately
  const _initPromise = (async () => {
    try {
      const resp = await fetch('/data/master_data.json');
      if (!resp.ok) return;
      const master: MasterData = await resp.json();
      const merged = mergeMasterData(initial, master);
      writeToStorage(merged);
      // Use set on the store directly (zustand supports this from the create callback)
      useMarketStore.setState({
        markets: merged,
        masterDataDate: master.generated_at || null,
        _lastTick: Date.now(),
      });
    } catch {
      // master_data.json not available — continue with localStorage data only
    }
  })();

  // Load rank history so we can show movement indicators
  const storedHistory = readRankHistory();
  const previousRanksInit = storedHistory?.ranks ?? {};

  return {
    markets: initial,
    masterDataDate: null,
    _lastTick: 0,
    scenarios: readScenarios(),
    previousRanks: previousRanksInit,
    portfolioAssets: readPortfolio(),

    getScoredMarkets: () => {
      return rankMarkets(toScorable(get().markets));
    },

    reload: () => {
      const markets = migrateStatuses(readFromStorage());
      set({ markets, _lastTick: Date.now() });
    },

    loadMasterData: async () => {
      try {
        const resp = await fetch('/data/master_data.json');
        if (!resp.ok) return;
        const master: MasterData = await resp.json();
        const merged = mergeMasterData(get().markets, master);
        writeToStorage(merged);
        set({ markets: merged, masterDataDate: master.generated_at || null, _lastTick: Date.now() });
      } catch {
        // master_data.json not available
      }
    },

    saveAll: (markets: MarketInput[]) => {
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    addMarket: (market: MarketInput) => {
      const markets = [...get().markets, market];
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    updateMarket: (market: MarketInput) => {
      const markets = get().markets.map(m => m.id === market.id ? market : m);
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    deleteMarket: (id: string) => {
      const markets = get().markets.filter(m => m.id !== id);
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    resetToDefaults: () => {
      const markets = [...UK_MARKETS];
      localStorage.removeItem(VERSION_KEY);
      writeToStorage(markets);
      const migrated = migrateStatuses(readFromStorage());
      set({ markets: migrated, _lastTick: Date.now() });
    },

    updateMetricValue: (marketId, metricId, value, source) => {
      const markets = get().markets.map(m => {
        if (m.id !== marketId) return m;
        return {
          ...m,
          values: { ...m.values, [metricId]: value },
          sources: { ...m.sources, [metricId]: source },
          updatedAt: new Date().toISOString(),
        };
      });
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    cascadeRegionalProxy: (originMarketId, region, metricId, value, source) => {
      const cascadedSource: MetricSource = {
        ...source,
        geographicLevel: 'regional',
        confidence: 'regional_proxy',
        status: 'REGIONAL_PROXY',
        regionalSourceMarketId: originMarketId,
      };
      const originSource: MetricSource = {
        ...source,
        geographicLevel: 'regional',
        confidence: 'regional_proxy',
        status: 'REGIONAL_PROXY',
      };

      const markets = get().markets.map(m => {
        if (m.region !== region) return m;
        const src = m.id === originMarketId ? originSource : cascadedSource;
        return {
          ...m,
          values: { ...m.values, [metricId]: value },
          sources: { ...m.sources, [metricId]: src },
          updatedAt: new Date().toISOString(),
        };
      });
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    setPipelineStatus: (marketId, status, notes) => {
      const now = new Date().toISOString();
      const markets = get().markets.map(m => {
        if (m.id !== marketId) return m;
        return {
          ...m,
          pipelineStatus: status,
          internalNotes: notes !== undefined ? notes : m.internalNotes,
          pipelineUpdatedAt: now,
          updatedAt: now,
        };
      });
      writeToStorage(markets);
      set({ markets, _lastTick: Date.now() });
    },

    saveScenario: (name, weights) => {
      const existing = get().scenarios.filter(s => s.name !== name);
      const updated = [...existing, { name, weights: [...weights], savedAt: new Date().toISOString() }];
      writeScenarios(updated);
      set({ scenarios: updated });
    },

    deleteScenario: (name) => {
      const updated = get().scenarios.filter(s => s.name !== name);
      writeScenarios(updated);
      set({ scenarios: updated });
    },

    snapshotRanks: () => {
      const scored = rankMarkets(toScorable(get().markets));
      const ranks: Record<string, number> = {};
      scored.forEach(m => { ranks[m.market.id] = m.rank; });
      const history: RankHistory = {
        snapshotDate: new Date().toISOString(),
        masterDataDate: get().masterDataDate,
        ranks,
      };
      writeRankHistory(history);
      set({ previousRanks: ranks });
    },

    addPortfolioAsset: (a) => {
      const next: PortfolioAsset = {
        ...a,
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        addedAt: new Date().toISOString(),
      };
      const updated = [...get().portfolioAssets, next];
      writePortfolio(updated);
      set({ portfolioAssets: updated });
    },

    updatePortfolioAsset: (id, patch) => {
      const updated = get().portfolioAssets.map(a => a.id === id ? { ...a, ...patch } : a);
      writePortfolio(updated);
      set({ portfolioAssets: updated });
    },

    deletePortfolioAsset: (id) => {
      const updated = get().portfolioAssets.filter(a => a.id !== id);
      writePortfolio(updated);
      set({ portfolioAssets: updated });
    },

    clearPortfolio: () => {
      writePortfolio([]);
      set({ portfolioAssets: [] });
    },
  };
});

// ─── Convenience selectors ────────────────────────────────────────────────────

/** Generate a unique market ID. */
export function generateId(): string {
  return `market-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
