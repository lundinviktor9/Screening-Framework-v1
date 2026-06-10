import { useState, useEffect } from 'react';
import { type DealRecord, useDealStore } from '../../store/useDealStore';
import { UK_MARKETS } from '../../data/ukMarkets';

interface EditableDeals {
  [dealId: string]: Partial<DealRecord>;
}

interface EditingCell {
  dealId: string;
  field: string;
}

export function EditableDealTable({ deals, onOpenDeal }: { deals: DealRecord[]; onOpenDeal?: (deal: DealRecord) => void }) {
  const [editedDeals, setEditedDeals] = useState<EditableDeals>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [newDealCounter, setNewDealCounter] = useState(0);
  const [localDeals, setLocalDeals] = useState(deals);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const addDeal = useDealStore(s => s.addDeal);
  const updateDeal = useDealStore(s => s.updateDeal);
  const deleteDeal = useDealStore(s => s.deleteDeal);

  useEffect(() => {
    setLocalDeals(deals);
  }, [deals]);

  const handleCellChange = (dealId: string, field: string, value: any) => {
    setEditedDeals(prev => ({
      ...prev,
      [dealId]: {
        ...prev[dealId],
        ...(field.includes('.')
          ? { [field.split('.')[0]]: { ...((prev[dealId] as any)?.[field.split('.')[0]] || {}), [field.split('.')[1]]: value } }
          : { [field]: value })
      }
    }));
    setHasChanges(true);
  };

  const handleAddDeal = () => {
    const newDealId = `new-deal-${newDealCounter}`;
    setNewDealCounter(prev => prev + 1);

    const newDeal: DealRecord = {
      deal_id: newDealId,
      status: 'extracted',
      source_filename: 'Manual Entry',
      pdf_hash: '',
      extracted_fields: {
        'Project Name': '',
        'Location': '',
        'Year Built': '',
        'Number of Tenants': null,
        'Economic occupancy rate, %': '',
        'Deal value, CCY': null,
        'Yield': null,
        'Yield2': null,
        'Market Status': 'On-market',
        'Comment': ''
      },
      market_ids: [],
      market_match_confidence: 0,
      microlocation_fit_score: 0,
      microlocation_narrative: ''
    };

    setLocalDeals(prev => [...prev, newDeal]);
    addDeal(newDeal);
    setHasChanges(true);
  };

  const handleSave = async () => {
    for (const [dealId, updates] of Object.entries(editedDeals)) {
      if (Object.keys(updates).length > 0) {
        updateDeal(dealId, updates);
      }
    }
    setEditedDeals({});
    setHasChanges(false);
    alert('Changes saved!');
  };

  const handleDelete = async (dealId: string) => {
    if (confirm('Delete this deal?')) {
      await deleteDeal(dealId);
      setLocalDeals(prev => prev.filter(d => d.deal_id !== dealId));
    }
  };

  const getCellValue = (deal: DealRecord, field: string): any => {
    const edited = editedDeals[deal.deal_id];
    if (edited && field in edited) return edited[field];

    if (field === 'Project Name') return deal.extracted_fields?.['Project Name'] || '';
    if (field === 'Market') return deal.market_ids?.[0] || '';
    if (field === 'Age') return deal.extracted_fields?.['Year Built'] || '';
    if (field === '# Tenants') return deal.extracted_fields?.['Number of Tenants'] || '';
    if (field === 'Occupancy') return deal.extracted_fields?.['Economic occupancy rate, %'] || '';
    if (field === 'Quoting Price') return deal.extracted_fields?.['Deal value, CCY'] || '';
    if (field === 'NIY') return deal.extracted_fields?.['Yield'] || '';
    if (field === 'RY') return deal.extracted_fields?.['Yield2'] || '';
    if (field === 'On / Off Market') return deal.extracted_fields?.['Market Status'] || 'On-market';
    if (field === 'Comment') return deal.extracted_fields?.['Comment'] || '';

    return '';
  };

  const formatCurrency = (val: any) => {
    if (!val) return '—';
    const n = Number(val);
    if (isNaN(n)) return val;
    if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}m`;
    if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
    return `£${n}`;
  };

  const formatPercent = (val: any) => {
    if (!val) return '—';
    const n = Number(val);
    return isNaN(n) ? val : `${n.toFixed(2)}%`;
  };

  const getMarketName = (marketId: string) => {
    const market = UK_MARKETS.find(m => m.id === marketId);
    return market?.name || marketId;
  };

  const formatCurrencyDisplay = (val: any) => {
    if (val === null || val === undefined || val === '') return '';
    const n = Number(val);
    if (isNaN(n)) return val;
    return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  };

  const formatPercentDisplay = (val: any) => {
    if (val === null || val === undefined || val === '') return '';
    const n = Number(val);
    if (isNaN(n)) return val;
    return n.toFixed(2) + '%';
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2 p-4 bg-white border-b">
        <button
          onClick={handleAddDeal}
          className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
        >
          + Add Deal
        </button>
        {hasChanges && (
          <>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
            >
              💾 Save Changes
            </button>
            <span className="text-amber-600 font-medium self-center">Unsaved changes</span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto h-full">
        <table className="w-full text-xs border-collapse" style={{minWidth: '1300px'}}>
          <colgroup>
            <col style={{width: '140px'}} />
            <col style={{width: '100px'}} />
            <col style={{width: '70px'}} />
            <col style={{width: '60px'}} />
            <col style={{width: '80px'}} />
            <col style={{width: '110px'}} />
            <col style={{width: '65px'}} />
            <col style={{width: '65px'}} />
            <col style={{width: '70px'}} />
            <col style={{width: '320px'}} />
            <col style={{width: '140px'}} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-700 text-white">
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Asset</th>
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Market</th>
              <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Age</th>
              <th className="px-2 py-2 text-center font-semibold whitespace-nowrap"># Tenants</th>
              <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">Occupancy</th>
              <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">Quoting Price</th>
              <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">NIY</th>
              <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">RY</th>
              <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">On / Off</th>
              <th className="px-2 py-2 text-left font-semibold">Comment</th>
              <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {localDeals.map((deal, idx) => (
              <tr key={deal.deal_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {/* Asset */}
                <td className="px-2 py-1 border-b border-gray-200">
                  <input
                    type="text"
                    value={getCellValue(deal, 'Project Name')}
                    onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Project Name', e.target.value)}
                    className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>

                {/* Market */}
                <td className="px-2 py-1 border-b border-gray-200">
                  <select
                    value={getCellValue(deal, 'Market')}
                    onChange={(e) => handleCellChange(deal.deal_id, 'market_ids', [e.target.value])}
                    className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Market</option>
                    {UK_MARKETS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </td>

                {/* Age */}
                <td className="px-2 py-1 border-b border-gray-200">
                  <input
                    type="text"
                    value={getCellValue(deal, 'Age')}
                    onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Year Built', e.target.value)}
                    className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 1980s, 2025"
                  />
                </td>

                {/* # Tenants */}
                <td className="px-2 py-1 border-b border-gray-200 text-center">
                  <input
                    type="number"
                    value={getCellValue(deal, '# Tenants') || ''}
                    onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Number of Tenants', e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-2 py-0.5 border border-gray-300 rounded text-right text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>

                {/* Occupancy */}
                <td className="px-2 py-1 border-b border-gray-200 text-center">
                  <input
                    type="text"
                    value={getCellValue(deal, 'Occupancy')}
                    onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Economic occupancy rate, %', e.target.value)}
                    className="w-full px-2 py-0.5 border border-gray-300 rounded text-right text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 100% or 87%"
                  />
                </td>

                {/* Quoting Price */}
                <td className="px-2 py-1 border-b border-gray-200 text-right cursor-pointer" onClick={() => setEditingCell({ dealId: deal.deal_id, field: 'Quoting Price' })}>
                  {editingCell?.dealId === deal.deal_id && editingCell?.field === 'Quoting Price' ? (
                    <input
                      type="number"
                      autoFocus
                      value={getCellValue(deal, 'Quoting Price') || ''}
                      onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Deal value, CCY', e.target.value ? Number(e.target.value) : null)}
                      onBlur={() => setEditingCell(null)}
                      className="w-full px-2 py-0.5 border border-gray-300 rounded text-right text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="px-2 py-0.5 text-xs font-medium text-gray-900">
                      {formatCurrencyDisplay(getCellValue(deal, 'Quoting Price'))}
                    </div>
                  )}
                </td>

                {/* NIY */}
                <td className="px-2 py-1 border-b border-gray-200 text-center cursor-pointer" onClick={() => setEditingCell({ dealId: deal.deal_id, field: 'NIY' })}>
                  {editingCell?.dealId === deal.deal_id && editingCell?.field === 'NIY' ? (
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={getCellValue(deal, 'NIY') || ''}
                      onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Yield', e.target.value ? Number(e.target.value) : null)}
                      onBlur={() => setEditingCell(null)}
                      className="w-full px-2 py-0.5 border border-gray-300 rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="px-2 py-0.5 text-xs font-medium text-gray-900">
                      {formatPercentDisplay(getCellValue(deal, 'NIY'))}
                    </div>
                  )}
                </td>

                {/* RY */}
                <td className="px-2 py-1 border-b border-gray-200 text-center cursor-pointer" onClick={() => setEditingCell({ dealId: deal.deal_id, field: 'RY' })}>
                  {editingCell?.dealId === deal.deal_id && editingCell?.field === 'RY' ? (
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={getCellValue(deal, 'RY') || ''}
                      onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Yield2', e.target.value ? Number(e.target.value) : null)}
                      onBlur={() => setEditingCell(null)}
                      className="w-full px-2 py-0.5 border border-gray-300 rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="px-2 py-0.5 text-xs font-medium text-gray-900">
                      {formatPercentDisplay(getCellValue(deal, 'RY'))}
                    </div>
                  )}
                </td>

                {/* On / Off Market */}
                <td className="px-2 py-1 border-b border-gray-200 text-center">
                  <select
                    value={getCellValue(deal, 'On / Off Market')}
                    onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Market Status', e.target.value)}
                    className="w-full px-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="On-market">On</option>
                    <option value="Off-market">Off</option>
                  </select>
                </td>

                {/* Comment */}
                <td className="px-2 py-1 border-b border-gray-200">
                  <input
                    type="text"
                    value={getCellValue(deal, 'Comment')}
                    onChange={(e) => handleCellChange(deal.deal_id, 'extracted_fields.Comment', e.target.value)}
                    className="w-full px-2 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    placeholder="Add notes..."
                  />
                </td>

                {/* Actions */}
                <td className="px-2 py-1 border-b border-gray-200 text-center whitespace-nowrap">
                  {onOpenDeal && (
                    <button
                      onClick={() => onOpenDeal(deal)}
                      className="px-2 py-0.5 text-blue-600 hover:bg-blue-50 rounded font-medium text-xs"
                    >
                      Underwrite
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(deal.deal_id)}
                    className="px-2 py-0.5 text-red-600 hover:bg-red-50 rounded font-medium text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
