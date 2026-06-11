import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDealStore, type DealRecord } from '../store/useDealStore';
import { EditableField } from '../components/showcase/EditableField';
import { SectionBand } from '../components/showcase/SectionBand';
import { KpiStrip } from '../components/showcase/KpiStrip';
import { MapCard } from '../components/showcase/MapCard';
import { PhotoCard } from '../components/showcase/PhotoCard';

export default function DealProfilePage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const deals = useDealStore((s) => s.deals);
  const patchShowcase = useDealStore((s) => s.patchShowcase);

  const deal = deals.find((d) => d.deal_id === dealId);
  const [tab, setTab] = useState<'overview' | 'financial'>('overview');

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Deal not found</p>
          <button
            onClick={() => navigate('/pipeline')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Back to Pipeline
          </button>
        </div>
      </div>
    );
  }

  const showcase = deal.showcase;
  const assetName = deal.extracted_fields?.['Project Name'] || 'Asset';
  const location = showcase?.location?.address || showcase?.location?.postcode || '—';
  const pp = deal.extracted_fields?.['Deal value, CCY'];
  const ry = deal.extracted_fields?.['Yield2'];

  const handleShowcaseChange = async (updates: any) => {
    try {
      await patchShowcase(dealId, updates);
    } catch (err) {
      console.error('Failed to update showcase:', err);
    }
  };

  const handleKpiEdit = async (key: string, value: any) => {
    const current = showcase?.kpis || {};
    await handleShowcaseChange({ kpis: { ...current, [key]: value } });
  };

  const handleBulletEdit = async (index: number, text: string, type: 'rationale' | 'business') => {
    if (type === 'rationale') {
      const bullets = showcase?.rationale_bullets || [];
      const updated = [...bullets];
      if (updated[index]) updated[index].text = text;
      await handleShowcaseChange({ rationale_bullets: updated });
    } else {
      const bullets = showcase?.business_plan_bullets || [];
      const updated = [...bullets];
      updated[index] = text;
      await handleShowcaseChange({ business_plan_bullets: updated });
    }
  };

  const handleLocationChange = async (lat: number, lng: number) => {
    const current = showcase?.location || {};
    await handleShowcaseChange({ location: { ...current, lat, lng } });
  };

  const handleImageSelect = async (file: string) => {
    const images = (showcase?.images || []).map((img) => ({
      ...img,
      selected: img.file === file,
    }));
    await handleShowcaseChange({ images });
  };

  // Find latest passed run with CFO data
  const latestPassedRun = deal.underwrite?.runs?.find((r: any) => r.checks?.pass && r.returns?.cfo);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-purple text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{assetName}</h1>
          <p className="text-sm text-purple-100 mt-1">
            {location} | PP: £{pp ? (pp / 1_000_000).toFixed(1) : '?'}m | RY: {ry ? `${ry}%` : '?'}
          </p>
        </div>
        <button
          onClick={() => navigate('/pipeline')}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 rounded font-medium"
        >
          ← Back
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white px-6 flex gap-4">
        <button
          onClick={() => setTab('overview')}
          className={`py-4 px-2 border-b-2 font-medium ${
            tab === 'overview' ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-600'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab('financial')}
          className={`py-4 px-2 border-b-2 font-medium ${
            tab === 'financial' ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-600'
          }`}
        >
          Financial Overview
        </button>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* KPI Strip */}
              {showcase?.kpis && (
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Key Metrics</h3>
                  <KpiStrip kpis={showcase.kpis} onEdit={handleKpiEdit} />
                </div>
              )}

              {/* Investment Rationale */}
              <SectionBand title="Investment Rationale">
                <div className="space-y-4">
                  {showcase?.rationale_bullets && showcase.rationale_bullets.length > 0 ? (
                    showcase.rationale_bullets.map((bullet, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="font-semibold text-sm text-gray-900">{bullet.label}</div>
                        <div className="text-sm text-gray-700">
                          <EditableField
                            value={bullet.text}
                            onChange={(v) => handleBulletEdit(idx, v, 'rationale')}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No rationale bullets</p>
                  )}
                </div>
              </SectionBand>

              {/* Business Plan */}
              <SectionBand title="Business Plan">
                <div className="space-y-3">
                  {showcase?.business_plan_bullets && showcase.business_plan_bullets.length > 0 ? (
                    showcase.business_plan_bullets.map((bullet, idx) => (
                      <div key={idx}>
                        <EditableField
                          value={bullet}
                          onChange={(v) => handleBulletEdit(idx, v, 'business')}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No business plan bullets</p>
                  )}
                </div>
              </SectionBand>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Map */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Location</h3>
                <MapCard location={showcase?.location} onLocationChange={handleLocationChange} />
              </div>

              {/* Photo */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Asset Photo</h3>
                <PhotoCard images={showcase?.images} onSelectImage={handleImageSelect} />
              </div>
            </div>
          </div>
        )}

        {tab === 'financial' && (
          <div className="space-y-6">
            {latestPassedRun ? (
              <>
                {/* Key Assumptions */}
                <SectionBand title="Key Assumptions">
                  <div className="grid grid-cols-2 gap-8 text-sm">
                    <div>
                      <div className="font-semibold text-gray-900">Entry</div>
                      <div className="mt-3 space-y-2">
                        <div>
                          <div className="text-xs text-gray-600">Acq Date</div>
                          <div className="font-medium">{latestPassedRun.assumptions?.entry_date || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">PP</div>
                          <div className="font-medium">
                            £{latestPassedRun.returns?.net_purchase_price?.toLocaleString() || '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">NIY %</div>
                          <div className="font-medium">{latestPassedRun.assumptions?.entry_yield || '—'}</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Financing</div>
                      <div className="mt-3 space-y-2">
                        <div>
                          <div className="text-xs text-gray-600">LTV</div>
                          <div className="font-medium">
                            {latestPassedRun.assumptions?.ltv ? `${(latestPassedRun.assumptions.ltv * 100).toFixed(0)}%` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Interest Rate</div>
                          <div className="font-medium">—</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Arrangement Fee</div>
                          <div className="font-medium">—</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionBand>

                {/* Returns */}
                <div className="grid grid-cols-2 gap-6">
                  <SectionBand title="Unlevered Returns, Pre-Tax, Post BRE Fees">
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="text-xs text-gray-600">IRR</div>
                        <div className="font-semibold text-brand-purple">
                          {latestPassedRun.returns?.cfo?.unlevered?.irr
                            ? `${(latestPassedRun.returns.cfo.unlevered.irr * 100).toFixed(2)}%`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">EM</div>
                        <div className="font-semibold text-brand-purple">
                          {latestPassedRun.returns?.cfo?.unlevered?.em?.toFixed(2) || '—'}x
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">CoC (Y5)</div>
                        <div className="font-semibold text-brand-purple">
                          {latestPassedRun.returns?.cfo?.unlevered?.coc_y5
                            ? `${(latestPassedRun.returns.cfo.unlevered.coc_y5 * 100).toFixed(2)}%`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Profit</div>
                        <div className="font-semibold text-brand-purple">
                          £{latestPassedRun.returns?.cfo?.unlevered?.profit?.toLocaleString() || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Equity</div>
                        <div className="font-semibold text-brand-purple">
                          £{latestPassedRun.returns?.cfo?.unlevered?.equity?.toLocaleString() || '—'}
                        </div>
                      </div>
                    </div>
                  </SectionBand>

                  <SectionBand title="Levered Returns, Post Tax, BRE Promote">
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="text-xs text-gray-600">IRR</div>
                        <div className="font-semibold text-brand-purple">
                          {latestPassedRun.returns?.cfo?.levered?.irr
                            ? `${(latestPassedRun.returns.cfo.levered.irr * 100).toFixed(2)}%`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">EM</div>
                        <div className="font-semibold text-brand-purple">
                          {latestPassedRun.returns?.cfo?.levered?.em?.toFixed(2) || '—'}x
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">CoC (Y5)</div>
                        <div className="font-semibold text-brand-purple">
                          {latestPassedRun.returns?.cfo?.levered?.coc_y5
                            ? `${(latestPassedRun.returns.cfo.levered.coc_y5 * 100).toFixed(2)}%`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Profit</div>
                        <div className="font-semibold text-brand-purple">
                          £{latestPassedRun.returns?.cfo?.levered?.profit?.toLocaleString() || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Equity</div>
                        <div className="font-semibold text-brand-purple">
                          £{latestPassedRun.returns?.cfo?.levered?.equity?.toLocaleString() || '—'}
                        </div>
                      </div>
                    </div>
                  </SectionBand>
                </div>
              </>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-6 text-center">
                <p className="text-yellow-800 font-medium">Returns withheld — checks not passed</p>
                <p className="text-sm text-yellow-700 mt-2">
                  Run a successful underwrite to see financial projections.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
