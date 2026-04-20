import { useNavigate, useParams } from 'react-router-dom';
import { useMarketStore, generateId } from '../store/marketStore';
import type { MarketInput } from '../types';
import MarketForm from '../components/market/MarketForm';

export default function AddMarketPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const markets = useMarketStore(s => s.markets);
  const addMarketAction = useMarketStore(s => s.addMarket);
  const updateMarketAction = useMarketStore(s => s.updateMarket);

  const existing = id ? markets.find(m => m.id === id) : undefined;

  function handleSave(data: Omit<MarketInput, 'id' | 'createdAt'> & { id?: string }) {
    if (existing) {
      updateMarketAction({ ...existing, ...data, updatedAt: new Date().toISOString() });
    } else {
      const market: MarketInput = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addMarketAction(market);
    }
    navigate('/');
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {existing ? `Edit: ${existing.name}` : 'Add New Market'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Enter values for all 60 metrics. Leave blank if data is unavailable — those metrics score 0.
        </p>
      </div>

      <MarketForm
        initial={existing}
        onSave={handleSave}
        onCancel={() => navigate('/')}
      />
    </div>
  );
}
