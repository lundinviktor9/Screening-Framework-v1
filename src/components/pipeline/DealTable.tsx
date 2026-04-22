import { useDealStore, type DealRecord } from '../../store/useDealStore';
import { UK_MARKETS } from '../../data/ukMarkets';

interface DealTableProps {
  deals: DealRecord[];
  selectedDeal: DealRecord | null;
  onSelectDeal: (deal: DealRecord) => void;
}

// Format helpers
function fmtCompactGbp(v: unknown): string {
  const n = Number(v);
  if (!v || isNaN(n)) return '—';
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}m`;
  if (n >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`;
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

function truncate60(v: unknown): string {
  const s = v === null || v === undefined || v === '' ? '—' : String(v);
  return s === '—' ? '—' : s.length > 60 ? s.slice(0, 60) + '...' : s;
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
            <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Asset</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Markets</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Age</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap"># Tenants</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Occupancy</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Quoting Price</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">NIY</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">RY</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Rent (£/sq ft)</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">WAULT</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Fit Score</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Status</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Comment</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Actions</th>
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
              {/* 1. Asset */}
              <td className="px-3 py-3">
                <div className="font-medium text-gray-900">
                  {deal.extracted_fields?.['Project Name'] || deal.source_filename}
                </div>
                {deal.extracted_fields?.Seller && (
                  <div className="text-xs text-gray-500">{deal.extracted_fields.Seller}</div>
                )}
              </td>

              {/* 2. Markets */}
              <td className="px-3 py-3">
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

              {/* 3. Age */}
              <td className="px-3 py-3 text-gray-700">
                {fmtStr(deal.extracted_fields?.['Year Built'])}
              </td>

              {/* 4. # Tenants */}
              <td className="px-3 py-3 text-gray-700">
                {fmtInt(deal.extracted_fields?.['Number of Tenants'])}
              </td>

              {/* 5. Occupancy */}
              <td className="px-3 py-3 text-gray-700">
                {fmtStr(deal.extracted_fields?.['Economic occupancy rate, %'])}
              </td>

              {/* 6. Quoting Price */}
              <td className="px-3 py-3 text-right text-gray-700">
                {fmtCompactGbp(deal.extracted_fields?.['Deal value, CCY'])}
              </td>

              {/* 7. NIY */}
              <td className="px-3 py-3 text-right text-gray-700">
                {fmtPct(deal.extracted_fields?.Yield)}
              </td>

              {/* 8. RY */}
              <td className="px-3 py-3 text-right text-gray-700">
                {fmtPct(deal.extracted_fields?.Yield2)}
              </td>

              {/* 9. Rent (£/sq ft) */}
              <td className="px-3 py-3 text-right text-gray-700">
                {fmtPsf(deal.extracted_fields?.['Base rent incl. index, CCY/sqft'])}
              </td>

              {/* 10. WAULT */}
              <td className="px-3 py-3 text-right text-gray-700">
                {fmtYears(deal.extracted_fields?.['WAULT, years'])}
              </td>

              {/* 11. Fit Score */}
              <td className="px-3 py-3 text-right">
                <span
                  className={`inline-block px-3 py-1 rounded-lg font-semibold text-sm ${
                    deal.microlocation_fit_score >= 70
                      ? 'bg-green-100 text-green-800'
                      : deal.microlocation_fit_score >= 40
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {deal.microlocation_fit_score.toFixed(0)}
                </span>
              </td>

              {/* 12. Status */}
              <td className="px-3 py-3">
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

              {/* 13. Comment */}
              <td className="px-3 py-3 text-gray-700 min-w-fit" title={String(deal.extracted_fields?.Comment || '')}>
                <span className="inline-block max-w-sm truncate">
                  {truncate60(deal.extracted_fields?.Comment)}
                </span>
              </td>

              {/* 14. Actions */}
              <td className="px-3 py-3">
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
