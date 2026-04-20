import { create } from 'zustand';
import type { MarketInput, MetricSource, MetricStatusFlag } from '../types';
import { UK_MARKETS } from '../data/ukMarkets';
import { rankMarkets } from '../utils/scoring';
import type { ScoredMarket } from '../types';
import { mergeMasterData, type MasterData } from '../utils/dataMerger';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sf_markets_v2';
const VERSION_KEY = 'sf_data_version';
const CURRENT_VERSION = 3;

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

/** One-time migration: assign status flags to legacy sources that lack them. */
function migrateStatuses(markets: MarketInput[]): MarketInput[] {
  const version = Number(localStorage.getItem(VERSION_KEY) || '0');
  if (version >= CURRENT_VERSION) return markets;

  const migrated = markets.map(m => {
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

  return {
    markets: initial,
    masterDataDate: null,
    _lastTick: 0,

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
  };
});

// ─── Convenience selectors ────────────────────────────────────────────────────

/** Generate a unique market ID. */
export function generateId(): string {
  return `market-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
