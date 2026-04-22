import { useDealStore, type DealRecord } from '../../store/useDealStore';
import { UK_MARKETS } from '../../data/ukMarkets';

interface DealTableProps {
  deals: DealRecord[];
  selectedDeal: DealRecord | null;
  onSelectDeal: (deal: DealRecord) => void;
}

export function DealTable({ deals, selectedDeal, onSelectDeal }: DealTableProps) {
  const deleteDeal = useDealStore(s => s.deleteDeal);

  async function handleDelete(dealId: string) {
    if (confirm('Delete this deal?')) {
      try {
        await deleteDeal(dealId);
      } catch (err) {
        alert('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Asset</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Markets</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-700">NIY</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-700">RY</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-700">Fit Score</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {deals.map(deal => (
            <tr
              key={deal.deal_id}
              onClick={() => onSelectDeal(deal)}
              className={`border-b border-gray-200 cursor-pointer transition-colors ${
                selectedDeal?.deal_id === deal.deal_id ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              {/* Asset name */}
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {deal.extracted_fields?.['Project Name'] || deal.source_filename}
                </div>
                <div className="text-xs text-gray-500">
                  {deal.extracted_fields?.Seller || 'Unknown seller'}
                </div>
              </td>

              {/* Markets */}
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  {deal.market_ids.map(m => {
                    const market = UK_MARKETS.find(mkt => mkt.id === m);
                    return (
                      <span key={m} className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        {market?.name || m}
                      </span>
                    );
                  })}
                  {!deal.market_ids.length && <span className="text-gray-400 text-xs">Unmatched</span>}
                </div>
              </td>

              {/* NIY */}
              <td className="px-4 py-3 text-right text-gray-700">
                {deal.extracted_fields?.Yield ? `${deal.extracted_fields.Yield.toFixed(2)}%` : '—'}
              </td>

              {/* RY */}
              <td className="px-4 py-3 text-right text-gray-700">
                {deal.extracted_fields?.Yield2 ? `${deal.extracted_fields.Yield2.toFixed(2)}%` : '—'}
              </td>

              {/* Fit score */}
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end">
                  <span
                    className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                      deal.microlocation_fit_score >= 70
                        ? 'bg-green-100 text-green-800'
                        : deal.microlocation_fit_score >= 50
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {deal.microlocation_fit_score.toFixed(0)}
                  </span>
                </div>
              </td>

              {/* Status */}
              <td className="px-4 py-3">
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
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete(deal.deal_id);
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
