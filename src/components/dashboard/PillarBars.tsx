import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ScoredMarket } from '../../types';
import { PILLARS } from '../../data/metrics';

const COLOURS = ['#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#DB2777'];

interface Props {
  markets: ScoredMarket[];
}

export default function PillarBars({ markets }: Props) {
  const data = PILLARS.map(p => {
    const entry: Record<string, string | number> = { pillar: p.name.split(' / ')[0] };
    for (const sm of markets) {
      entry[sm.market.name] = parseFloat((sm.pillarScores[p.name]?.score ?? 0).toFixed(2));
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
        <XAxis dataKey="pillar" tick={{ fontSize: 10, fill: '#6b7280' }} />
        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <Tooltip
          formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e9e6f5' }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        {markets.map((sm, i) => (
          <Bar
            key={sm.market.id}
            dataKey={sm.market.name}
            fill={COLOURS[i % COLOURS.length]}
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
