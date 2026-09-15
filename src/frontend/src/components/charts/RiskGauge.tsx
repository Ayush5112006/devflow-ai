import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import type { RiskLevel } from '../../types';
import { riskHex } from '../../store/useAppStore';

interface RiskGaugeProps {
  score: number; // 0–100
  riskLevel: RiskLevel;
  size?: number;
}

export function RiskGauge({ score, riskLevel, size = 160 }: RiskGaugeProps) {
  const color = riskHex(riskLevel);
  const data = [{ name: 'risk', value: score, fill: color }];

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="62%"
            outerRadius="100%"
            startAngle={200}
            endAngle={-20}
            data={data}
            barSize={14}
          >
            <RadialBar
              dataKey="value"
              background={{ fill: '#1e3a5f' }}
              cornerRadius={8}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Centre overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-bold font-mono leading-none"
            style={{ color }}
          >
            {score}
          </span>
          <span
            className="text-xs font-semibold uppercase tracking-widest mt-1 capitalize"
            style={{ color }}
          >
            {riskLevel}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500">Risk Score / 100</p>
    </div>
  );
}
