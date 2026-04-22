import { useEffect, useMemo, useState } from 'react';
import { useDealStore, type DealRecord } from '../../store/useDealStore';
import { DealUploadPanel } from './DealUploadPanel';
import { DealCardList } from './DealCardList';
import { DealMap } from './DealMap';
import { DealProfileDrawer } from './DealProfileDrawer';
import './PipelineTab.css';

export function PipelineTab() {
  const rawDeals = useDealStore(s => s.deals);
  const filters = useDealStore(s => s.filters);
  const loading = useDealStore(s => s.loading);
  const fetchDeals = useDealStore(s => s.fetchDeals);

  const deals = useMemo(
    () => useDealStore.getState().getFilteredDeals(),
    [rawDeals, filters]
  );

  const [selectedDeal, setSelectedDeal] = useState<DealRecord | null>(null);

  useEffect(() => {
    fetchDeals();
  }, []);

  return (
    <div className="pipeline-container">
      {/* Header */}
      <div className="pipeline-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investment Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload IMs, view extracted data, and manage deal profiles
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {deals.length} deal{deals.length !== 1 ? 's' : ''} extracted
        </div>
      </div>

      {/* Upload panel */}
      <DealUploadPanel />

      {/* Main content: Table + Map */}
      <div className="pipeline-content">
        <div className="pipeline-table-section">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading deals...</div>
          ) : deals.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No deals yet. Upload PDFs to get started.
            </div>
          ) : (
            <DealCardList
              deals={deals}
              selectedDeal={selectedDeal}
              onSelectDeal={setSelectedDeal}
            />
          )}
        </div>

        <div className="pipeline-map-section">
          {deals.length > 0 && <DealMap deals={deals} selectedDeal={selectedDeal} />}
        </div>
      </div>

      {/* Drawer (slides in from right) */}
      {selectedDeal && (
        <DealProfileDrawer
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </div>
  );
}
