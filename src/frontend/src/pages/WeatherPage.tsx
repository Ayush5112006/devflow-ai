import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Cloud,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldAlert,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  mockCurrentWeather,
  mockForecast,
  mockWeatherRisks,
  mockZoneWeather,
  mockWeatherAssetRisks,
  mockWeatherRecommendations,
  mockTimeline,
  mockPrecautions,
  weatherEmoji,
  weatherLabel,
  type WeatherCondition,
} from '../mock/weatherMockData';
import type {
  WeatherAssetRisk,
  WeatherRecommendation,
  ForecastRange,
  ZoneWeatherStatus,
} from '../mock/weatherMockData';
import { RiskBadge } from '../components/ui/StatusBadge';
import { StatCard } from '../components/ui/StatCard';
import type { RiskLevel, Zone } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const riskHex: Record<RiskLevel, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
};

const riskBgClass: Record<RiskLevel, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high:     'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low:      'bg-green-500/15 text-green-400 border-green-500/30',
};

const riskBorderLeft: Record<RiskLevel, string> = {
  critical: 'border-l-red-500',
  high:     'border-l-orange-500',
  medium:   'border-l-yellow-500',
  low:      'border-l-green-500',
};

const statusStyles = {
  pending:      'bg-slate-500/15 text-slate-400',
  acknowledged: 'bg-blue-500/15 text-blue-400',
  actioned:     'bg-green-500/15 text-green-400',
};

const severityBar = (score: number, level: RiskLevel) => (
  <div className="flex items-center gap-2 w-full">
    <div className="flex-1 h-1.5 rounded-full bg-navy-900 overflow-hidden">
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${score}%`, background: riskHex[level] }}
      />
    </div>
    <span className="text-xs font-mono w-8 text-right" style={{ color: riskHex[level] }}>
      {score}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Current weather card
// ─────────────────────────────────────────────────────────────────────────────

function CurrentWeatherCard() {
  const w = mockCurrentWeather;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="label-muted mb-1">Current Conditions</p>
          <div className="flex items-center gap-3">
            <span className="text-5xl leading-none">{weatherEmoji[w.condition]}</span>
            <div>
              <p className="text-4xl font-bold text-white font-mono">{w.temperature_c}°C</p>
              <p className="text-slate-400 text-sm">{weatherLabel[w.condition]}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Feels like</p>
          <p className="text-2xl font-bold text-orange-400 font-mono">{w.feels_like_c}°C</p>
          <p className="text-xs text-amber-400 font-semibold mt-1">Heat Alert Active</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Droplets size={14} />,   label: 'Humidity',    value: `${w.humidity_pct}%` },
          { icon: <Wind size={14} />,        label: 'Wind',        value: `${w.wind_speed_kmh} km/h ${w.wind_direction}` },
          { icon: <Cloud size={14} />,       label: 'Rain Prob.',  value: `${w.rain_probability_pct}%` },
          { icon: <Droplets size={14} />,   label: 'Precip.',     value: `${w.precipitation_mm} mm` },
          { icon: <Eye size={14} />,         label: 'Visibility',  value: `${w.visibility_km} km` },
          { icon: <Thermometer size={14} />, label: 'UV Index',    value: String(w.uv_index) },
          { icon: <ShieldAlert size={14} />, label: 'Pressure',   value: `${w.pressure_hpa} hPa` },
          { icon: <RefreshCw size={14} />,   label: 'Updated',     value: new Date(w.last_updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) },
        ].map(({ icon, label, value }) => (
          <div key={label} className="bg-navy-900 rounded-lg p-2.5 border border-surface-border/50">
            <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
              {icon}
              <span className="text-[10px] uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-sm font-semibold text-slate-200">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Forecast strip
// ─────────────────────────────────────────────────────────────────────────────

function ForecastStrip({ range }: { range: ForecastRange }) {
  const count = range === '24h' ? 5 : range === '3d' ? 7 : 10;
  const periods = mockForecast.slice(0, count);

  return (
    <div className="card p-4">
      <p className="label-muted mb-3">
        {range === '24h' ? '24-Hour Forecast' : range === '3d' ? '3-Day Forecast' : '7-Day Forecast'}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {periods.map((p, i) => (
          <div
            key={i}
            className={`
              shrink-0 w-[120px] rounded-xl p-3 border text-center
              ${riskBgClass[p.severity]} border-opacity-50
            `}
          >
            <p className="text-[10px] text-slate-400 mb-2 truncate">{p.label}</p>
            <p className="text-2xl mb-1">{weatherEmoji[p.condition]}</p>
            <p className="text-sm font-bold text-white">{p.temp_high_c}°</p>
            <p className="text-[10px] text-slate-500">{p.temp_low_c}° low</p>
            <div className="mt-2 space-y-0.5 text-[10px] text-slate-400">
              <p>💧 {p.rain_probability_pct}%</p>
              <p>💨 {p.wind_speed_kmh} km/h</p>
              <p>💦 {p.precipitation_mm} mm</p>
            </div>
            <div className={`mt-2 text-[10px] font-semibold capitalize px-1 py-0.5 rounded-full
                              ${riskBgClass[p.severity]}`}>
              {p.severity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather risk indicators
// ─────────────────────────────────────────────────────────────────────────────

function WeatherRiskCards() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {mockWeatherRisks.map((r) => (
        <button
          key={r.id}
          onClick={() => setExpanded(expanded === r.id ? null : r.id)}
          className={`card p-4 text-left transition-all hover:shadow-card-hover
                      border-l-4 ${riskBorderLeft[r.level]}
                      ${expanded === r.id ? 'ring-2 ring-brand-400/50' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white">{r.label}</p>
            <ChevronDown
              size={13}
              className={`text-slate-500 transition-transform ${expanded === r.id ? 'rotate-180' : ''}`}
            />
          </div>
          {severityBar(r.score, r.level)}
          <p className={`text-xs font-bold mt-1 capitalize ${
            { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-green-400' }[r.level]
          }`}>{r.level}</p>

          {expanded === r.id && (
            <div className="mt-3 pt-3 border-t border-surface-border/50 space-y-2 text-xs text-left">
              <p className="text-slate-300 leading-relaxed">{r.explanation}</p>
              <div className="bg-navy-900 rounded-lg p-2.5 border border-surface-border/50">
                <p className="text-[10px] text-slate-500 uppercase mb-1">Grid Impact</p>
                <p className="text-slate-300 leading-relaxed">{r.grid_impact}</p>
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather impact timeline chart
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 font-medium mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

function TimelineChart() {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-white mb-4">Weather Impact Timeline (24h)</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={mockTimeline} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[40, 100]}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => (
              <span style={{ color: '#94a3b8' }}>{value}</span>
            )}
          />
          <Line
            type="monotone"
            dataKey="weather_severity"
            name="Weather Severity"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="sensor_risk"
            name="Sensor Risk"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="combined_risk"
            name="Combined Risk"
            stroke="#ef4444"
            strokeWidth={2.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone weather status
// ─────────────────────────────────────────────────────────────────────────────

function ZoneWeatherGrid({
  zones,
  selectedZone,
  onSelect,
}: {
  zones: ZoneWeatherStatus[];
  selectedZone: Zone | 'all';
  onSelect: (z: Zone | 'all') => void;
}) {
  const filtered = selectedZone === 'all' ? zones : zones.filter((z) => z.zone === selectedZone);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {filtered.map((z) => (
        <button
          key={z.zone}
          onClick={() => onSelect(selectedZone === z.zone ? 'all' : z.zone)}
          className={`card p-4 text-left hover:bg-navy-750 transition-all
                      border-l-4 ${riskBorderLeft[z.weather_risk]}
                      ${selectedZone === z.zone ? 'ring-2 ring-brand-400/50' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-white">{z.zone} Zone</p>
            <span className="text-xl">{weatherEmoji[z.condition]}</span>
          </div>
          <p className="text-xs text-slate-400 mb-2">{z.temperature_c}°C · {weatherLabel[z.condition]}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Weather Risk</span>
              <RiskBadge level={z.weather_risk} size="sm" />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Highest Asset Risk</span>
              <RiskBadge level={z.highest_asset_risk} size="sm" />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Assets Affected</span>
              <span className="font-mono font-semibold text-white">{z.affected_assets}</span>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400 leading-relaxed line-clamp-2">
            {z.recommended_action}
          </p>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather-aware asset risk table
// ─────────────────────────────────────────────────────────────────────────────

function AssetRiskTable({
  assets,
  onSelect,
  selected,
}: {
  assets: WeatherAssetRisk[];
  onSelect: (a: WeatherAssetRisk | null) => void;
  selected: WeatherAssetRisk | null;
}) {
  if (assets.length === 0) {
    return (
      <div className="card py-16 text-center">
        <Cloud size={36} className="text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-medium">No assets match current filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="bg-navy-900 border-b border-surface-border">
            {['Asset', 'Type', 'Zone', 'Sensor Risk', 'Weather Risk', 'Combined Risk', 'Main Factor', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left label-muted whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-navy-800 divide-y divide-surface-border/50">
          {assets.map((a) => (
            <tr
              key={a.asset_id}
              onClick={() => onSelect(selected?.asset_id === a.asset_id ? null : a)}
              className={`hover:bg-navy-750 cursor-pointer transition-colors
                          ${selected?.asset_id === a.asset_id ? 'bg-brand-600/10 ring-1 ring-inset ring-brand-500/30' : ''}`}
            >
              <td className="px-4 py-3">
                <p className="font-mono text-xs text-brand-400 font-semibold">{a.asset_id}</p>
                <p className="text-xs text-slate-400 truncate max-w-[140px]">{a.asset_name}</p>
              </td>
              <td className="px-4 py-3 text-xs text-slate-400 capitalize">
                {a.asset_type.replace('_', ' ')}
              </td>
              <td className="px-4 py-3 text-xs font-medium text-slate-300">{a.zone}</td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <RiskBadge level={a.sensor_risk} size="sm" />
                  <span className="text-[10px] font-mono text-slate-500">{a.sensor_risk_score}/100</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <RiskBadge level={a.weather_risk} size="sm" />
                  <span className="text-[10px] font-mono text-slate-500">{a.weather_risk_score}/100</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full capitalize
                                ${riskBgClass[a.combined_risk]}`}
                  >
                    {a.combined_risk}
                  </span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: riskHex[a.combined_risk] }}>
                    {a.combined_risk_score}/100
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px]">
                <p className="line-clamp-2">{a.main_factor}</p>
              </td>
              <td className="px-4 py-3">
                <ChevronRight
                  size={15}
                  className={`transition-transform ${selected?.asset_id === a.asset_id ? 'rotate-90 text-brand-400' : 'text-slate-600'}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset detail panel (inline expand)
// ─────────────────────────────────────────────────────────────────────────────

function AssetDetailPanel({ asset, onClose }: { asset: WeatherAssetRisk; onClose: () => void }) {
  return (
    <div className="card p-5 border-l-4 border-l-brand-500 mt-3">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-mono text-sm font-bold text-brand-400">{asset.asset_id}</p>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${riskBgClass[asset.combined_risk]}`}
            >
              Re-eval: {asset.combined_risk}
            </span>
          </div>
          <p className="text-sm text-slate-300">{asset.asset_name}</p>
          <p className="text-xs text-slate-500 capitalize">{asset.asset_type.replace('_', ' ')} · {asset.zone} Zone</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sensor readings */}
        <div>
          <p className="label-muted mb-2">Sensor Readings</p>
          <div className="space-y-2">
            {[
              { label: 'Temperature',       value: `${asset.sensor_temp_c}°C`,         alert: asset.sensor_temp_c > 85 },
              { label: 'Vibration',         value: `${asset.sensor_vibration} mm/s`,    alert: asset.sensor_vibration > 7.5 },
              { label: 'Oil Quality',       value: `${asset.sensor_oil_quality}/100`,   alert: asset.sensor_oil_quality < 30 },
              { label: 'Partial Discharge', value: `${asset.sensor_partial_discharge} mV`, alert: asset.sensor_partial_discharge > 500 },
            ].map(({ label, value, alert }) => (
              <div key={label}
                className={`flex items-center justify-between text-xs p-2 rounded-lg border
                            ${alert ? 'bg-red-500/10 border-red-500/25' : 'bg-navy-900 border-surface-border/50'}`}
              >
                <span className="text-slate-400">{label}</span>
                <span className={`font-mono font-semibold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk breakdown */}
        <div>
          <p className="label-muted mb-2">Risk Breakdown</p>
          <div className="space-y-3">
            {[
              { label: 'Sensor Risk',   score: asset.sensor_risk_score,   level: asset.sensor_risk },
              { label: 'Weather Risk',  score: asset.weather_risk_score,   level: asset.weather_risk },
              { label: 'Combined Risk', score: asset.combined_risk_score,  level: asset.combined_risk },
            ].map(({ label, score, level }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">{label}</span>
                  <RiskBadge level={level as RiskLevel} size="sm" />
                </div>
                {severityBar(score, level as RiskLevel)}
              </div>
            ))}
          </div>
          <div className="mt-3 p-2.5 bg-navy-900 rounded-lg border border-surface-border/50">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Weather Impact</p>
            <p className="text-xs text-slate-300 leading-relaxed">{asset.weather_impact}</p>
          </div>
        </div>

        {/* Recommendation */}
        <div>
          <p className="label-muted mb-2">Recommendation</p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-amber-300 mb-1">Main Factor</p>
            <p className="text-xs text-amber-200/80 leading-relaxed">{asset.main_factor}</p>
          </div>
          <div className="bg-brand-600/10 border border-brand-500/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-brand-300 mb-1">Recommended Action</p>
            <p className="text-xs text-slate-300 leading-relaxed">{asset.recommendation}</p>
          </div>
          <Link
            to={`/assets/${asset.asset_id}`}
            className="mt-3 flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            <ExternalLink size={12} />
            View full asset detail
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations section
// ─────────────────────────────────────────────────────────────────────────────

function RecommendationsList({
  recommendations,
  onStatusChange,
  statuses,
}: {
  recommendations: WeatherRecommendation[];
  onStatusChange: (id: string, status: WeatherRecommendation['status']) => void;
  statuses: Record<string, WeatherRecommendation['status']>;
}) {
  return (
    <div className="space-y-3">
      {recommendations.map((r) => {
        const status = statuses[r.id] ?? r.status;
        return (
          <div
            key={r.id}
            className={`card p-4 border-l-4 ${riskBorderLeft[r.priority]}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <RiskBadge level={r.priority} />
                  <span className="font-mono text-xs text-brand-400 font-semibold">{r.asset_id}</span>
                  <span className="text-xs text-slate-500">{r.zone} Zone</span>
                </div>
                <p className="text-sm font-semibold text-white mb-1">{r.asset_name}</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">{r.reason}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-navy-900 rounded-lg p-2.5 border border-surface-border/50">
                    <p className="text-slate-500 mb-0.5">Recommended Action</p>
                    <p className="text-slate-200">{r.action}</p>
                  </div>
                  <div className="bg-navy-900 rounded-lg p-2.5 border border-surface-border/50">
                    <p className="text-slate-500 mb-0.5">Suggested Time</p>
                    <p className="text-amber-300 font-semibold">{r.suggested_time}</p>
                  </div>
                </div>
              </div>

              {/* Status controls */}
              <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${statusStyles[status]}`}>
                  {status}
                </span>
                {status === 'pending' && (
                  <button
                    onClick={() => onStatusChange(r.id, 'acknowledged')}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg
                               bg-blue-500/15 text-blue-400 border border-blue-500/25
                               hover:bg-blue-500/25 transition-colors whitespace-nowrap"
                  >
                    <CheckCircle2 size={11} /> Acknowledge
                  </button>
                )}
                {status === 'acknowledged' && (
                  <button
                    onClick={() => onStatusChange(r.id, 'actioned')}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg
                               bg-green-500/15 text-green-400 border border-green-500/25
                               hover:bg-green-500/25 transition-colors whitespace-nowrap"
                  >
                    <CheckCircle2 size={11} /> Mark Actioned
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Precautionary measures
// ─────────────────────────────────────────────────────────────────────────────

function PrecautionaryMeasures() {
  const [open, setOpen] = useState<string | null>('heat');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {mockPrecautions.map((group) => (
        <div key={group.id} className="card overflow-hidden">
          <button
            onClick={() => setOpen(open === group.id ? null : group.id)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-navy-750 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{group.icon}</span>
              <span className={`text-sm font-semibold ${group.color}`}>{group.label}</span>
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-500 transition-transform ${open === group.id ? 'rotate-180' : ''}`}
            />
          </button>
          {open === group.id && (
            <div className="border-t border-surface-border px-4 pb-4 pt-3">
              <ul className="space-y-2">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className={`shrink-0 mt-0.5 ${group.color}`}>•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main WeatherPage
// ─────────────────────────────────────────────────────────────────────────────

export function WeatherPage() {
  const [forecastRange, setForecastRange] = useState<ForecastRange>('24h');
  const [selectedZone, setSelectedZone] = useState<Zone | 'all'>('all');
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'all'>('all');
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<WeatherAssetRisk | null>(null);
  const [recStatuses, setRecStatuses] = useState<Record<string, WeatherRecommendation['status']>>({});

  const handleRecStatus = (id: string, status: WeatherRecommendation['status']) => {
    setRecStatuses((prev) => ({ ...prev, [id]: status }));
  };

  // Zone → condition map (derived once from static mock data)
  const zoneConditionMap = useMemo(
    () => Object.fromEntries(mockZoneWeather.map((z) => [z.zone, z.condition])),
    [],
  );

  // Filtered asset risks — condition filter uses the zone's current weather condition
  const filteredAssets = useMemo(() => {
    return mockWeatherAssetRisks.filter((a) => {
      if (selectedZone !== 'all' && a.zone !== selectedZone) return false;
      if (filterRisk !== 'all' && a.combined_risk !== filterRisk) return false;
      if (filterCondition !== 'all') {
        const zoneCondition = zoneConditionMap[a.zone] as WeatherCondition | undefined;
        if (zoneCondition !== filterCondition) return false;
      }
      if (assetSearch) {
        const q = assetSearch.toLowerCase();
        if (!a.asset_id.toLowerCase().includes(q) && !a.asset_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [selectedZone, filterRisk, filterCondition, assetSearch, zoneConditionMap]);

  // Filtered recommendations
  const filteredRecs = useMemo(() => {
    return mockWeatherRecommendations.filter((r) => {
      if (selectedZone !== 'all' && r.zone !== selectedZone) return false;
      if (filterRisk !== 'all' && r.priority !== filterRisk) return false;
      return true;
    });
  }, [selectedZone, filterRisk]);

  // KPI summary
  const criticalCount = mockWeatherAssetRisks.filter((a) => a.combined_risk === 'critical').length;
  const escalatedCount = mockWeatherAssetRisks.filter((a) => a.combined_risk_score > a.sensor_risk_score + 5).length;
  const pendingRecs = mockWeatherRecommendations.filter((r) => (recStatuses[r.id] ?? r.status) === 'pending').length;

  return (
    <div className="p-6 space-y-8 max-w-[1600px]">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cloud size={20} className="text-brand-400" />
            <h1 className="page-title">Weather Intelligence</h1>
          </div>
          <p className="page-subtitle">
            Weather-aware grid risk and maintenance recommendations ·{' '}
            <span className="text-slate-300">
              Updated {new Date(mockCurrentWeather.last_updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zone selector */}
          <div className="relative">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value as Zone | 'all')}
              className="select-dark pr-8 text-xs"
              aria-label="Select zone"
            >
              <option value="all">All Zones</option>
              {(['North', 'South', 'East', 'West', 'Central'] as Zone[]).map((z) => (
                <option key={z} value={z}>{z} Zone</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
          </div>

          {/* Forecast range */}
          <div className="flex items-center bg-navy-900 border border-surface-border rounded-lg overflow-hidden">
            {(['24h', '3d', '7d'] as ForecastRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setForecastRange(r)}
                className={`px-3 py-2 text-xs font-medium transition-colors
                            ${forecastRange === r ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                {r === '24h' ? '24 Hours' : r === '3d' ? '3 Days' : '7 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Combined Critical"
          value={criticalCount}
          icon={AlertTriangle}
          accent="red"
          subtitle="Assets re-evaluated to critical"
        />
        <StatCard
          title="Weather-Escalated"
          value={escalatedCount}
          icon={Cloud}
          accent="orange"
          subtitle="Risk raised by weather conditions"
        />
        <StatCard
          title="Active Alerts"
          value={mockWeatherRisks.filter((r) => r.level === 'critical' || r.level === 'high').length}
          icon={ShieldAlert}
          accent="yellow"
          subtitle="Critical or high weather risks"
        />
        <StatCard
          title="Pending Actions"
          value={pendingRecs}
          icon={Clock}
          accent="blue"
          subtitle="Recommendations awaiting action"
        />
      </div>

      {/* ── Current weather + Forecast ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CurrentWeatherCard />
        <ForecastStrip range={forecastRange} />
      </div>

      {/* ── Weather risk indicators ── */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <ShieldAlert size={15} className="text-brand-400" />
          Weather Risk Indicators
        </h2>
        <WeatherRiskCards />
      </section>

      {/* ── Zone weather status ── */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Cloud size={15} className="text-brand-400" />
          Zone Weather Status
          {selectedZone !== 'all' && (
            <button
              onClick={() => setSelectedZone('all')}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 ml-2"
            >
              <X size={11} /> Clear filter
            </button>
          )}
        </h2>
        <ZoneWeatherGrid
          zones={mockZoneWeather}
          selectedZone={selectedZone}
          onSelect={setSelectedZone}
        />
      </section>

      {/* ── Weather impact timeline ── */}
      <TimelineChart />

      {/* ── Weather-aware asset risk ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Thermometer size={15} className="text-brand-400" />
            Weather-Aware Asset Risk
            <span className="text-slate-500 text-xs font-normal">
              ({filteredAssets.length} assets)
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search assets…"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="input-dark pl-8 py-1.5 text-xs w-44"
                aria-label="Search assets"
              />
            </div>
            {/* Risk filter */}
            <div className="relative">
              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value as RiskLevel | 'all')}
                className="select-dark pr-8 text-xs"
                aria-label="Filter by risk"
              >
                <option value="all">All Combined Risks</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
            </div>
            {/* Condition filter (display-only — reflects selected zone's weather) */}
            <div className="relative">
              <select
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                className="select-dark pr-8 text-xs"
                aria-label="Filter by condition"
              >
                <option value="all">All Conditions</option>
                <option value="hot">Extreme Heat</option>
                <option value="thunderstorm">Thunderstorm</option>
                <option value="heavy_rain">Heavy Rain</option>
                <option value="windy">High Winds</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
            </div>
          </div>
        </div>

        <AssetRiskTable
          assets={filteredAssets}
          onSelect={setSelectedAsset}
          selected={selectedAsset}
        />

        {/* Expanded asset detail */}
        {selectedAsset && (
          <AssetDetailPanel
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
          />
        )}
      </section>

      {/* ── Weather-adjusted recommendations ── */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-400" />
          Weather-Adjusted Recommendations
          <span className="text-slate-500 text-xs font-normal">
            ({filteredRecs.length} recommendations)
          </span>
        </h2>
        {filteredRecs.length > 0 ? (
          <RecommendationsList
            recommendations={filteredRecs}
            onStatusChange={handleRecStatus}
            statuses={recStatuses}
          />
        ) : (
          <div className="card py-12 text-center">
            <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No recommendations for selected filters</p>
          </div>
        )}
      </section>

      {/* ── Precautionary measures ── */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <ShieldAlert size={15} className="text-brand-400" />
          Precautionary Measures
        </h2>
        <PrecautionaryMeasures />
      </section>
    </div>
  );
}
