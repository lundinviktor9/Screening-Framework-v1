import { type DealRecord, useDealStore } from '../../store/useDealStore';
import { useMarketStore } from '../../store/marketStore';
import { UK_MARKETS } from '../../data/ukMarkets';

interface DealProfileDrawerProps {
  deal: DealRecord;
  onClose: () => void;
}

export function DealProfileDrawer({ deal, onClose }: DealProfileDrawerProps) {
  const markets = useMarketStore(s => s.markets);
  const overrideMarket = useDealStore(s => s.overrideMarket);
  const deleteDeal = useDealStore(s => s.deleteDeal);

  const matchedMarkets = markets.filter(m => deal.market_ids.includes(m.id));

  async function handleDelete() {
    if (confirm('Delete this deal?')) {
      try {
        await deleteDeal(deal.deal_id);
        onClose();
      } catch (err) {
        alert('Delete failed');
      }
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg z-20 flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex justify-between items-start">
        <div>
          <h2 className="font-bold text-lg">
            {deal.extracted_fields?.['Project Name'] || 'Deal'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">{deal.source_filename}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase">Status</label>
          <div className="mt-1">
            <span
              className={`text-xs font-medium px-2 py-1 rounded ${
                deal.status === 'extracted'
                  ? 'bg-blue-100 text-blue-800'
                  : deal.status === 'reviewed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              {deal.status}
            </span>
          </div>
        </div>

        {/* Matched Markets */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase">
            Matched Markets ({(deal.market_match_confidence * 100).toFixed(0)}% confidence)
          </label>
          <div className="mt-2 space-y-1">
            {deal.market_ids.map(marketId => {
              const market = UK_MARKETS.find(m => m.id === marketId);
              return market ? (
                <div
                  key={market.id}
                  className="p-2 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="font-medium text-sm">{market.name}</div>
                  <div className="text-xs text-gray-600">{market.region}</div>
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Fit Score */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase">Fit Score</label>
          <p className="text-xs text-gray-500 mt-1">
            Weighted score based on matched market's pillar performance (Supply, Demand, Connectivity, Labour, Rents & Yields, Risk). Strategy-adjusted for deal type.
          </p>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {deal.microlocation_fit_score.toFixed(0)}
              </span>
              <span className="text-gray-500">/100</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${deal.microlocation_fit_score}%` }}
              />
            </div>
            {deal.microlocation_narrative && (
              <p className="text-xs text-gray-600 mt-2 italic">{deal.microlocation_narrative}</p>
            )}
          </div>
        </div>

        {/* Narrative */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase">
            Microlocation Narrative
          </label>
          <p className="mt-2 text-sm text-gray-700 leading-relaxed">
            {deal.microlocation_narrative}
          </p>
        </div>

        {/* Key Financials */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase">
            Key Financials
          </label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[
              ['NIY', 'Yield', '%'],
              ['RY', 'Yield2', '%'],
              ['Deal Value', 'Deal value, CCY', 'GBP'],
              ['WAULT', 'WAULT, years', 'yrs']
            ].map(([label, field, unit]) => (
              <div key={label} className="text-sm">
                <div className="text-xs text-gray-600">{label}</div>
                <div className="font-semibold">
                  {deal.extracted_fields?.[field as keyof typeof deal.extracted_fields]?.toFixed?.(2) ||
                    deal.extracted_fields?.[field as keyof typeof deal.extracted_fields] ||
                    '—'}
                  {unit && <span className="text-xs text-gray-500"> {unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Occupancy & Tenants */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase">Occupancy</label>
            <div className="mt-1 font-semibold">
              {deal.extracted_fields?.['Economic occupancy rate, %'] || '—'}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase"># Tenants</label>
            <div className="mt-1 font-semibold">
              {deal.extracted_fields?.['Number of Tenants'] || '—'}
            </div>
          </div>
        </div>

        {/* Errors (if any) */}
        {deal.extraction_errors && deal.extraction_errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <div className="text-xs font-semibold text-red-800">Extraction Errors</div>
            <ul className="mt-1 text-xs text-red-700 list-disc list-inside">
              {deal.extraction_errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t p-4 space-y-2">
        <button
          onClick={() => window.open(`http://localhost:8787/pdf/${deal.deal_id}`, '_blank')}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm"
        >
          Open PDF
        </button>
        <button
          onClick={handleDelete}
          className="w-full px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-medium text-sm"
        >
          Delete Deal
        </button>
      </div>
    </div>
  );
}
