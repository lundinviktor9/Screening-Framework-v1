import { EditableField } from './EditableField';

interface KpiStripProps {
  kpis: Record<string, any> | null | undefined;
  onEdit: (key: string, value: any) => void;
}

const KPI_LABELS: Record<string, string> = {
  tenure: 'Tenure',
  units: 'Units',
  lettable_area_sqft: 'Area (sqft)',
  occupancy_pct: 'Occupancy %',
  passing_rent_psf: 'Passing Rent (psf)',
  capital_value_psf: 'Cap Value (psf)',
  niy_pct: 'NIY %',
  ry_pct: 'RY %',
};

export function KpiStrip({ kpis, onEdit }: KpiStripProps) {
  const kpiKeys = Object.keys(KPI_LABELS);
  const cells = kpiKeys.map((key) => ({
    key,
    label: KPI_LABELS[key],
    value: kpis?.[key],
  }));

  return (
    <div className="grid grid-cols-2 gap-4">
      {cells.map(({ key, label, value }) => (
        <div key={key} className="bg-brand-cardBg rounded p-3">
          <div className="text-xs text-gray-600 font-medium">{label}</div>
          <div className="mt-1 text-sm font-semibold text-brand-purple">
            <EditableField
              value={value}
              onChange={(v) => onEdit(key, v)}
              type={key.includes('area') || key.includes('rent') || key.includes('value') ? 'number' : 'text'}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
