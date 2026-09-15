import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from 'recharts';
import type { SensorReading } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────

type SensorTab = 'temperature' | 'vibration' | 'oil_quality' | 'partial_discharge';

interface TabConfig {
  label: string;
  key: keyof SensorReading;
  unit: string;
  threshold: number;
  thresholdLabel: string;
  color: string;
  alertWhen: 'above' | 'below';
}

const TABS: Record<SensorTab, TabConfig> = {
  temperature: {
    label: 'Temperature',
    key: 'temperature_c',
    unit: '°C',
    threshold: 85,
    thresholdLabel: 'Alert Threshold 85°C',
    color: '#ef4444',
    alertWhen: 'above',
  },
  vibration: {
    label: 'Vibration',
    key: 'vibration_mm_s',
    unit: 'mm/s',
    threshold: 7.5,
    thresholdLabel: 'Alert Threshold 7.5 mm/s',
    color: '#f97316',
    alertWhen: 'above',
  },
  oil_quality: {
    label: 'Oil Quality',
    key: 'oil_quality_index',
    unit: '',
    threshold: 30,
    thresholdLabel: 'Alert Below 30',
    color: '#22c55e',
    alertWhen: 'below',
  },
  partial_discharge: {
    label: 'Partial Discharge',
    key: 'partial_discharge_mv',
    unit: 'mV',
    threshold: 500,
    thresholdLabel: 'Alert Threshold 500 mV',
    color: '#8b5cf6',
    alertWhen: 'above',
  },
};

interface SensorTrendChartProps {
  readings: SensorReading[];
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="font-bold text-white">
          {(payload[0].value as number).toFixed(1)}
          {unit}
        </p>
      </div>
    );
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AlertDot = (props: any) => {
  const { cx, cy, value, threshold, alertWhen, color } = props;
  const isAlert = alertWhen === 'above' ? value > threshold : value < threshold;
  if (!isAlert) return <Dot cx={cx} cy={cy} r={0} fill="transparent" />;
  return <Dot cx={cx} cy={cy} r={4} fill={color} stroke="#0f2342" strokeWidth={2} />;
};

export function SensorTrendChart({ readings, height = 260 }: SensorTrendChartProps) {
  const [activeTab, setActiveTab] = useState<SensorTab>('temperature');
  const cfg = TABS[activeTab];

  const data = readings.map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: r[cfg.key] as number,
  }));

  const latestValue = data.at(-1)?.value ?? 0;
  const isAlert = cfg.alertWhen === 'above'
    ? latestValue > cfg.threshold
    : latestValue < cfg.threshold;

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 p-1 bg-navy-900 rounded-lg w-fit">
        {(Object.entries(TABS) as [SensorTab, TabConfig][]).map(([key, tab]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === key
                ? 'bg-navy-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Current value + alert */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-2xl font-bold text-white font-mono">
            {latestValue.toFixed(1)}
          </span>
          <span className="text-sm text-slate-400 ml-1">{cfg.unit}</span>
          <span className="text-xs text-slate-500 ml-2">current</span>
        </div>
        {isAlert && (
          <span className="text-xs font-semibold bg-red-500/15 text-red-400
                           border border-red-500/30 px-2 py-1 rounded-lg">
            ⚠ Above threshold
          </span>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(v) => `${v}${cfg.unit}`}
          />
          <Tooltip
            content={<CustomTooltip unit={cfg.unit} />}
            cursor={{ stroke: '#2a5298', strokeWidth: 1 }}
          />
          <ReferenceLine
            y={cfg.threshold}
            stroke="#ef4444"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: cfg.thresholdLabel,
              fill: '#ef4444',
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={cfg.color}
            strokeWidth={2}
            dot={
              <AlertDot
                threshold={cfg.threshold}
                alertWhen={cfg.alertWhen}
                color={cfg.color}
              />
            }
            activeDot={{ r: 5, fill: cfg.color, stroke: '#0f2342', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
