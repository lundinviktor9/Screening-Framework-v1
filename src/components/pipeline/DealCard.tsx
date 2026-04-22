import { type DealRecord } from '../../store/useDealStore';
import { UK_MARKETS } from '../../data/ukMarkets';

interface DealCardProps {
  deal: DealRecord;
  isSelected: boolean;
  onSelect: (deal: DealRecord) => void;
  onDelete: (dealId: string) => void;
}

// Format helpers (same as in DealTable)
function fmtCompactGbp(v: unknown): string {
  const n = Number(v);
  if (!v || isNaN(n)) return '—';
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}m`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n}`;
}

function fmtPsf(v: unknown): string {
  const n = Number(v);
  return !v || isNaN(n) ? '—' : `£${n.toFixed(2)}`;
}

function fmtYears(v: unknown): string {
  const n = Number(v);
  return !v || isNaN(n) ? '—' : `${n} yrs`;
}

function fmtStr(v: unknown): string {
  return v === null || v === undefined || v === '' ? '—' : String(v);
}

function fmtInt(v: unknown): string {
  const n = Number(v);
  return !v || isNaN(n) ? '—' : String(Math.round(n));
}

function fmtPct(v: unknown): string {
  const n = Number(v);
  return !v || isNaN(n) ? '—' : `${n.toFixed(2)}%`;
}

export function DealCard({ deal, isSelected, onSelect, onDelete }: DealCardProps) {
  const assetName = deal.extracted_fields?.['Project Name'] || deal.source_filename;
  const seller = deal.extracted_fields?.Seller;
  const fitScore = deal.microlocation_fit_score;

  // Get market names
  const marketNames = deal.market_ids.map(id => {
    const market = UK_MARKETS.find(m => m.id === id);
    return market?.name || id;
  }).join(', ');

  return (
    <div
      onClick={() => onSelect(deal)}
      className={`bg-white rounded-lg border-2 p-6 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 shadow-md'
          : 'border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Header Row: Asset, Market pills, Status, Seller */}
      <div className="mb-5 pb-4 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{assetName}</h3>
            {seller && <p className="text-xs text-gray-500 mt-1">{seller}</p>}
          </div>
          <span
            className={`ml-4 px-3 py-1 rounded-lg font-semibold text-sm whitespace-nowrap ${
              fitScore >= 70
                ? 'bg-green-100 text-green-800'
                : fitScore >= 40
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {fitScore.toFixed(0)}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            {deal.market_ids.map(id => {
              const market = UK_MARKETS.find(m => m.id === id);
              return (
                <span
                  key={id}
                  className="px-2.5 py-1 rounded-full text-xs bg-blue-100 text-blue-800 font-medium"
                >
                  {market?.name || id}
                </span>
              );
            })}
            {!deal.market_ids.length && (
              <span className="text-gray-400 text-xs">Unmatched</span>
            )}
          </div>

          <span
            className={`text-xs font-medium px-2 py-1 rounded ml-auto ${
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

      {/* Big Numbers Row: Quoting Price, NIY, RY, Fit Score */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-500 mb-1">Quoting Price</p>
          <p className="text-lg font-bold text-gray-900">
            {fmtCompactGbp(deal.extracted_fields?.['Deal value, CCY'])}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-500 mb-1">NIY</p>
          <p className="text-lg font-bold text-gray-900">
            {fmtPct(deal.extracted_fields?.Yield)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-500 mb-1">RY</p>
          <p className="text-lg font-bold text-gray-900">
            {fmtPct(deal.extracted_fields?.Yield2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-500 mb-1">Fit Score</p>
          <p className="text-lg font-bold text-gray-900">{fitScore.toFixed(0)}</p>
        </div>
      </div>

      {/* Details Grid: Age, Tenants, Occupancy, Rent, WAULT */}
      <div className="grid grid-cols-2 gap-4 mb-5 pb-5 border-b border-gray-200 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500 font-medium">Age</p>
          <p className="text-sm font-semibold text-gray-900">
            {fmtStr(deal.extracted_fields?.['Year Built'])}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium"># Tenants</p>
          <p className="text-sm font-semibold text-gray-900">
            {fmtInt(deal.extracted_fields?.['Number of Tenants'])}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Occupancy</p>
          <p className="text-sm font-semibold text-gray-900">
            {fmtStr(deal.extracted_fields?.['Economic occupancy rate, %'])}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Rent (£/sq ft)</p>
          <p className="text-sm font-semibold text-gray-900">
            {fmtPsf(deal.extracted_fields?.['Base rent incl. index, CCY/sqft'])}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">WAULT</p>
          <p className="text-sm font-semibold text-gray-900">
            {fmtYears(deal.extracted_fields?.['WAULT, years'])}
          </p>
        </div>
      </div>

      {/* Comment in italics */}
      {deal.extracted_fields?.Comment && (
        <div className="mb-5 py-3 px-3 bg-gray-50 border-l-2 border-gray-300">
          <p className="text-sm italic text-gray-700">
            "{deal.extracted_fields.Comment}"
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={e => {
            e.stopPropagation();
            onSelect(deal);
          }}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
        >
          View Profile
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            if (confirm('Delete this deal?')) {
              onDelete(deal.deal_id);
            }
          }}
          className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
