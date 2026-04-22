import { create } from 'zustand';

export interface DealRecord {
  deal_id: string;
  status: 'extracted' | 'reviewed' | 'failed';
  source_filename: string;
  pdf_hash: string;
  extracted_fields: Record<string, any>;
  market_ids: string[];
  market_match_confidence: number;
  microlocation_fit_score: number;
  microlocation_narrative: string;
  extraction_errors?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface DealStore {
  deals: DealRecord[];
  loading: boolean;
  error: string | null;

  // Fetch deals from server
  fetchDeals: () => Promise<void>;

  // Add/update deals
  addDeal: (deal: DealRecord) => void;
  updateDeal: (dealId: string, updates: Partial<DealRecord>) => void;
  deleteDeal: (dealId: string) => Promise<void>;

  // Market override
  overrideMarket: (dealId: string, marketIds: string[]) => Promise<void>;

  // Filters
  setFilters: (filters: DealFilters) => void;
  filters: DealFilters;

  // Sorted/filtered deals
  getFilteredDeals: () => DealRecord[];
}

export interface DealFilters {
  search?: string;
  markets?: string[];
  minFitScore?: number;
  maxFitScore?: number;
  status?: ('extracted' | 'reviewed' | 'failed')[];
  minNIY?: number;
  maxNIY?: number;
  minWAULT?: number;
  maxWAULT?: number;
}

const API_BASE = 'http://localhost:8787';

export const useDealStore = create<DealStore>((set, get) => ({
  deals: [],
  loading: false,
  error: null,
  filters: {},

  fetchDeals: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/deals`);
      if (!response.ok) throw new Error('Failed to fetch deals');
      const deals = await response.json();
      set({ deals });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ loading: false });
    }
  },

  addDeal: (deal) => {
    set(state => ({
      deals: [...state.deals, deal]
    }));
  },

  updateDeal: (dealId, updates) => {
    set(state => ({
      deals: state.deals.map(d => d.deal_id === dealId ? { ...d, ...updates } : d)
    }));
  },

  deleteDeal: async (dealId) => {
    try {
      const response = await fetch(`${API_BASE}/deals/${dealId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete deal');
      set(state => ({
        deals: state.deals.filter(d => d.deal_id !== dealId)
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      throw err;
    }
  },

  overrideMarket: async (dealId, marketIds) => {
    try {
      const response = await fetch(`${API_BASE}/deals/${dealId}/market-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_ids: marketIds })
      });
      if (!response.ok) throw new Error('Failed to override market');
      const updated = await response.json();
      get().updateDeal(dealId, updated);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      throw err;
    }
  },

  setFilters: (filters) => {
    set({ filters });
  },

  getFilteredDeals: () => {
    const { deals, filters } = get();

    return deals.filter(deal => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!deal.source_filename.toLowerCase().includes(s) &&
            !deal.microlocation_narrative.toLowerCase().includes(s)) {
          return false;
        }
      }

      if (filters.markets && filters.markets.length > 0) {
        if (!deal.market_ids.some(m => filters.markets!.includes(m))) {
          return false;
        }
      }

      if (filters.minFitScore !== undefined && deal.microlocation_fit_score < filters.minFitScore) {
        return false;
      }

      if (filters.maxFitScore !== undefined && deal.microlocation_fit_score > filters.maxFitScore) {
        return false;
      }

      if (filters.status && filters.status.length > 0 && !filters.status.includes(deal.status)) {
        return false;
      }

      const niy = deal.extracted_fields?.Yield;
      if (filters.minNIY !== undefined && niy && niy < filters.minNIY) {
        return false;
      }
      if (filters.maxNIY !== undefined && niy && niy > filters.maxNIY) {
        return false;
      }

      const wault = deal.extracted_fields?.['WAULT, years'];
      if (filters.minWAULT !== undefined && wault && wault < filters.minWAULT) {
        return false;
      }
      if (filters.maxWAULT !== undefined && wault && wault > filters.maxWAULT) {
        return false;
      }

      return true;
    });
  }
}));
