import { useEffect, useMemo, useState } from 'react';
import { useDealStore, type DealRecord } from '../store/useDealStore';
import { DealProfileDrawer } from '../components/pipeline/DealProfileDrawer';

export default function UnderwritePage() {
  const rawDeals = useDealStore(s => s.deals);
  const loading = useDealStore(s => s.loading);
  const fetchDeals = useDealStore(s => s.fetchDeals);
  const [selectedDeal, setSelectedDeal] = useState<DealRecord | null>(null);

  const deals = useMemo(
    () => useDealStore.getState().getFilteredDeals(),
    [rawDeals]
  );

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Underwriting</h1>
        <p className="text-gray-500 text-sm mt-1">
          Select a deal to run MLI underwrite analysis (Mode A → review flags → Mode B → returns)
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center text-gray-500">Loading deals...</div>
      )}

      {/* Empty state */}
      {!loading && deals.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No deals yet. <a href="/pipeline" className="text-blue-600 hover:underline">Go to Pipeline</a> to upload an IM.
        </div>
      )}

      {/* Deal list */}
      {!loading && deals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map(deal => {
            const underwrite = deal.underwrite;
            const status = underwrite?.status || 'not_started';
            const statusBg = status === 'underwritten'
              ? 'bg-green-100 text-green-800'
              : status === 'checks_failed'
              ? 'bg-red-100 text-red-800'
              : status === 'flagged'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-gray-100 text-gray-800';

            return (
              <button
                key={deal.deal_id}
                onClick={() => setSelectedDeal(deal)}
                className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all text-left"
              >
                <h3 className="font-semibold text-gray-900">
                  {deal.extracted_fields?.['Project Name'] || 'Deal'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {deal.source_filename}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${statusBg}`}>
                    {status === 'not_started' ? 'Not Started' :
                     status === 'flagged' ? 'Flags Pending' :
                     status === 'underwritten' ? 'Underwritten' :
                     status === 'checks_failed' ? 'Checks Failed' :
                     status}
                  </span>
                  {underwrite?.returns && (
                    <span className="text-xs font-semibold text-blue-600">
                      {((underwrite.returns.unlevered_irr || 0) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                {underwrite?.asset && (
                  <p className="text-xs text-gray-600 mt-2">{underwrite.asset}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Deal detail drawer */}
      {selectedDeal && (
        <DealProfileDrawer deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
      )}
    </div>
  );
}
