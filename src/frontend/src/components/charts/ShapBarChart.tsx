import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ShapFactor } from '../../types';

interface ShapBarChartProps {
  factors: ShapFactor[];
  height?: number;
}

const BAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as ShapFactor;
    return (
      <div className="bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-300 font-medium">{d.name}</p>
        <p className="text-white font-bold mt-0.5">
          +{d.value}% risk contribution
        </p>
      </div>
    );
  }
  return null;
};

export function ShapBarChart({ factors, height = 220 }: ShapBarChartProps) {
  // Sort descending for display
  const sorted = [...factors].sort((a, b) => b.value - a.value);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          layout="vertical"
          data={sorted}
          margin={{ top: 4, right: 40, left: 10, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 45]}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={130}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e3a5f' }} />
          <ReferenceLine x={0} stroke="#334155" />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
            {sorted.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend-style labels */}
      <div className="mt-3 space-y-1.5 px-2">
        {sorted.map((f, i) => (
          <div key={f.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
              />
              <span className="text-slate-400">{f.name}</span>
            </div>
            <span className="font-mono font-semibold text-slate-200">+{f.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
