import type { MarketInput } from '../types';
import { UK_MARKETS } from '../data/ukMarkets';

const STORAGE_KEY = 'sf_markets_v2'; // v2 to flush old sample data

export function loadMarkets(): MarketInput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...UK_MARKETS];
    const parsed: MarketInput[] = JSON.parse(raw);
    return parsed.length > 0 ? parsed : [...UK_MARKETS];
  } catch {
    return [...UK_MARKETS];
  }
}

export function saveMarkets(markets: MarketInput[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(markets));
}

export function addMarket(market: MarketInput): void {
  const markets = loadMarkets();
  markets.push(market);
  saveMarkets(markets);
}

export function updateMarket(market: MarketInput): void {
  const markets = loadMarkets();
  const idx = markets.findIndex(m => m.id === market.id);
  if (idx !== -1) {
    markets[idx] = market;
    saveMarkets(markets);
  }
}

export function deleteMarket(id: string): void {
  const markets = loadMarkets();
  saveMarkets(markets.filter(m => m.id !== id));
}

export function generateId(): string {
  return `market-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Reset all markets back to the default UK pre-filled dataset */
export function resetToDefaults(): void {
  saveMarkets([...UK_MARKETS]);
}
