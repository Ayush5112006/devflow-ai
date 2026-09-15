import { CircleMarker, Tooltip, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import type { Asset, RiskLevel } from '../../types';

interface RiskMarkerProps {
  asset: Asset;
  isSelected?: boolean;
  onClick?: (id: string) => void;
}

const riskColors: Record<RiskLevel, string> = {
  low:      '#22c55e',
  medium:   '#eab308',
  high:     '#f97316',
  critical: '#ef4444',
};

const riskRadii: Record<RiskLevel, number> = {
  low:      7,
  medium:   9,
  high:     11,
  critical: 13,
};

export function RiskMarker({ asset, isSelected, onClick }: RiskMarkerProps) {
  const color = riskColors[asset.risk_level];
  const baseRadius = riskRadii[asset.risk_level];
  const radius = isSelected ? baseRadius + 4 : baseRadius;

  return (
    <CircleMarker
      center={[asset.location.lat, asset.location.lng]}
      radius={radius}
      pathOptions={{
        color: isSelected ? '#60a5fa' : color,
        fillColor: color,
        fillOpacity: isSelected ? 0.95 : 0.8,
        weight: isSelected ? 3 : 2,
        opacity: 1,
      }}
      eventHandlers={{ click: () => onClick?.(asset.id) }}
    >
      <Tooltip direction="top" offset={[0, -radius]} className="leaflet-dark-tooltip">
        <div className="text-xs min-w-[140px]">
          <p className="font-bold text-white">{asset.id}</p>
          <p className="text-slate-300 capitalize">{asset.type.replace('_', ' ')}</p>
          <p className="text-slate-400">
            Risk: <span className="font-semibold capitalize" style={{ color }}>{asset.risk_level}</span>
            {' '}· {asset.risk_score}/100
          </p>
        </div>
      </Tooltip>
      <Popup>
        <div className="min-w-[200px] text-sm space-y-2 py-1">
          <div>
            <p className="font-bold text-white text-base leading-tight">{asset.id}</p>
            <p className="text-slate-400 text-xs capitalize mt-0.5">
              {asset.type.replace('_', ' ')} · {asset.zone}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-slate-500">Risk Score</p>
              <p className="font-bold" style={{ color }}>{asset.risk_score}/100</p>
            </div>
            <div>
              <p className="text-slate-500">Risk Level</p>
              <p className="font-bold capitalize" style={{ color }}>{asset.risk_level}</p>
            </div>
            <div>
              <p className="text-slate-500">Customers at Risk</p>
              <p className="font-bold text-white">{asset.customers_served.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <p className="font-bold text-white capitalize">{asset.status}</p>
            </div>
          </div>

          <Link
            to={`/assets/${asset.id}`}
            className="block w-full text-center py-1.5 rounded-lg text-xs font-semibold
                       bg-brand-600 text-white hover:bg-brand-700 transition-colors mt-1"
          >
            View Details →
          </Link>
        </div>
      </Popup>
    </CircleMarker>
  );
}
