import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { COMPETENCY_META } from '../data/blocks';
import { DIMS, type Dim } from '../engine/profile';

export default function CompetencyRadar({
  first,
  now,
  height = 320,
  firstLabel = 'First run',
  nowLabel = 'Latest run',
}: {
  first: Record<Dim, number | null> | null;
  now: Record<Dim, number | null>;
  height?: number;
  firstLabel?: string;
  nowLabel?: string;
}) {
  const data = DIMS.map((d) => ({ dim: COMPETENCY_META[d].short, first: first?.[d] ?? 0, now: now[d] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="#D6CFBF" />
        <PolarAngleAxis dataKey="dim" tick={{ fill: '#16161A', fontSize: 13, fontWeight: 700, fontFamily: 'Atkinson Hyperlegible' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        {first && <Radar name={firstLabel} dataKey="first" stroke="#5E5E66" fill="#5E5E66" fillOpacity={0.08} strokeDasharray="5 4" strokeWidth={2} />}
        <Radar name={nowLabel} dataKey="now" stroke="#16161A" fill="#FFC629" fillOpacity={0.55} strokeWidth={2} />
        <Tooltip formatter={(v: number) => `${v}`} contentStyle={{ border: '1.5px solid #16161A', borderRadius: 6, fontFamily: 'Atkinson Hyperlegible' }} />
        <Legend wrapperStyle={{ fontSize: 13, fontWeight: 700 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
