import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { COMPETENCY_META } from '../data/blocks';
import { DIMS, type Dim } from '../engine/profile';

export default function CompetencyRadar({
  first,
  now,
  height = 320,
  firstLabel = 'First try (anticipated)',
  nowLabel = 'After fixing',
}: {
  first: Record<Dim, number | null> | null;
  now: Record<Dim, number | null>;
  height?: number;
  firstLabel?: string;
  nowLabel?: string;
}) {
  const data = DIMS.map((d) => ({
    dim: `${COMPETENCY_META[d].icon} ${COMPETENCY_META[d].label}`,
    first: first?.[d] ?? 0,
    now: now[d] ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#DCD7F5" />
        <PolarAngleAxis dataKey="dim" tick={{ fill: '#312E81', fontSize: 12, fontWeight: 700 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        {first && <Radar name={firstLabel} dataKey="first" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} strokeDasharray="4 3" strokeWidth={2} />}
        <Radar name={nowLabel} dataKey="now" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.35} strokeWidth={2.5} />
        <Tooltip formatter={(v: number) => `${v}%`} />
        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
