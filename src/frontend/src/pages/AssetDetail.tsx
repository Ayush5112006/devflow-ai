import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Activity,
  AlertTriangle,
  Thermometer,
  Clock,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { RiskBadge, StatusBadge } from '../components/ui/StatusBadge';
import { RiskGauge } from '../components/charts/RiskGauge';
import { SensorTrendChart } from '../components/charts/SensorTrendChart';
import { ShapBarChart } from '../components/charts/ShapBarChart';

export function AssetDetail() {
  const { assetId } = useParams<{ assetId: string }>();
  const loadData = useAppStore((s) => s.loadData);
  const isLoading = useAppStore((s) => s.isLoading);
  const assets = useAppStore((s) => s.assets);
  const tasks = useAppStore((s) => s.maintenanceTasks);

  useEffect(() => { loadData(); }, [loadData]);

  if (isLoading) return <LoadingSpinner size="lg" label="Loading asset…" />;

  const asset = assets.find((a) => a.id === assetId);

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <AlertTriangle size={40} className="text-red-400" />
        <h2 className="text-xl font-bold text-white">Asset Not Found</h2>
        <p className="text-slate-400 text-sm">
          No asset with ID <code className="text-brand-400">{assetId}</code> was found.
        </p>
        <Link to="/assets" className="btn-primary">
          ← Back to Assets
        </Link>
      </div>
    );
  }

  const latestReading = asset.sensor_readings.at(-1);
  const assetTasks = tasks.filter((t) => t.asset_id === asset.id);

  const priorityBadge: Record<string, string> = {
    emergency: 'bg-red-500/15 text-red-400 border-red-500/25',
    urgent:    'bg-orange-500/15 text-orange-400 border-orange-500/25',
    routine:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      {/* Back nav */}
      <Link
        to="/assets"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400
                   hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Asset Rankings
      </Link>

      {/* ── Header ── */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Left: identity */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{asset.id}</h1>
              <RiskBadge level={asset.risk_level} />
              <StatusBadge status={asset.status} />
            </div>
            <p className="text-slate-300 text-sm capitalize mb-4">
              {asset.name}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              {[
                { icon: Activity, label: 'Asset Type', value: asset.type.replace('_', ' ') },
                { icon: MapPin, label: 'Zone', value: asset.zone },
                { icon: Users, label: 'Customers', value: asset.customers_served.toLocaleString() },
                { icon: Calendar, label: 'Install Year', value: String(asset.install_year) },
                { icon: Thermometer, label: 'Age', value: `${asset.age_years} years` },
                { icon: Clock, label: 'Last Inspected', value: asset.last_inspected },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon size={13} className="text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500">{label}</p>
                    <p className="font-semibold text-slate-200 capitalize">{value}</p>
                  </div>
                </div>
              ))}
            </div>
            {asset.notes && (
              <div className="mt-4 text-xs text-amber-300/80 bg-amber-500/10 border
                              border-amber-500/20 rounded-lg p-3 leading-relaxed">
                <strong className="text-amber-300">Note: </strong>{asset.notes}
              </div>
            )}
          </div>

          {/* Right: gauge */}
          <div className="shrink-0">
            <RiskGauge
              score={asset.risk_score}
              riskLevel={asset.risk_level}
              size={170}
            />
          </div>
        </div>
      </div>

      {/* ── Prediction metrics row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: '7-Day Failure Probability',
            value: `${Math.round(asset.failure_probability_7d * 100)}%`,
            color: asset.failure_probability_7d > 0.6 ? 'text-red-400' : 'text-white',
            sub: 'Next 7 days',
          },
          {
            label: '30-Day Failure Probability',
            value: `${Math.round(asset.failure_probability_30d * 100)}%`,
            color: asset.failure_probability_30d > 0.7 ? 'text-red-400' : 'text-white',
            sub: 'Next 30 days',
          },
          {
            label: 'Weather Risk Factor',
            value: `${Math.round(asset.weather_risk_factor * 100)}%`,
            color: 'text-white',
            sub: 'Environmental exposure',
          },
          {
            label: 'Next Maintenance',
            value: asset.next_maintenance,
            color: 'text-white',
            sub: `Last: ${asset.last_maintenance}`,
          },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="card p-4">
            <p className="label-muted truncate">{label}</p>
            <p className={`text-xl font-bold mt-1 font-mono ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Latest sensor snapshot ── */}
      {latestReading && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Thermometer size={15} className="text-brand-400" />
            Latest Sensor Readings
            <span className="text-xs text-slate-500 font-normal ml-1">
              {new Date(latestReading.timestamp).toLocaleString()}
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                label: 'Temperature',
                value: `${latestReading.temperature_c.toFixed(1)}°C`,
                alert: latestReading.temperature_c > 85,
              },
              {
                label: 'Vibration',
                value: `${latestReading.vibration_mm_s.toFixed(2)} mm/s`,
                alert: latestReading.vibration_mm_s > 7.5,
              },
              {
                label: 'Partial Discharge',
                value: `${latestReading.partial_discharge_mv.toFixed(1)} mV`,
                alert: latestReading.partial_discharge_mv > 500,
              },
              {
                label: 'Oil Quality',
                value: `${latestReading.oil_quality_index.toFixed(1)}/100`,
                alert: latestReading.oil_quality_index < 30,
              },
              {
                label: 'Load',
                value: `${latestReading.load_percent.toFixed(1)}%`,
                alert: false,
              },
            ].map(({ label, value, alert }) => (
              <div
                key={label}
                className={`bg-navy-900 rounded-lg p-3 border ${
                  alert ? 'border-red-500/30 bg-red-500/5' : 'border-surface-border'
                }`}
              >
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                <p
                  className={`font-bold text-sm mt-0.5 font-mono ${
                    alert ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {value}
                </p>
                {alert && (
                  <p className="text-[10px] text-red-400 mt-0.5">⚠ Threshold exceeded</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sensor trends + SHAP ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sensor trend chart */}
        <div className="xl:col-span-2 card p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={15} className="text-brand-400" />
            Sensor Trends (30-day)
          </h2>
          <SensorTrendChart readings={asset.sensor_readings} height={260} />
        </div>

        {/* SHAP risk factors */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-400" />
            Risk Factor Breakdown
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            AI-attributed contribution to risk score
          </p>
          <ShapBarChart factors={asset.shap_factors} height={200} />
        </div>
      </div>

      {/* ── Maintenance history ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-white">Maintenance Tasks</h2>
        </div>
        {assetTasks.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No maintenance tasks scheduled for this asset.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-surface-border bg-navy-900">
                  {['Date', 'Action', 'Crew', 'Priority', 'Duration', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left label-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-navy-800 divide-y divide-surface-border/50">
                {assetTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-navy-750 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-300">{task.scheduled_date}</td>
                    <td className="px-4 py-3 text-xs text-slate-200">{task.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{task.assigned_team}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize
                                    ${priorityBadge[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      {task.estimated_duration_hours}h
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 capitalize">
                      {task.status.replace('_', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Location */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <MapPin size={15} className="text-brand-400" />
          Location
        </h2>
        <div className="flex flex-wrap gap-6 text-xs text-slate-400 mb-4">
          <span>Lat: <strong className="text-white">{asset.location.lat}</strong></span>
          <span>Lng: <strong className="text-white">{asset.location.lng}</strong></span>
          <span>Zone: <strong className="text-white">{asset.zone}</strong></span>
        </div>
        <Link to="/map" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
          View on Grid Map →
        </Link>
      </div>
    </div>
  );
}
