// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for GridGuard AI
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AssetType =
  | 'transformer'
  | 'substation'
  | 'transmission_line'
  | 'circuit_breaker'
  | 'capacitor_bank';

export type AssetStatus = 'online' | 'offline' | 'maintenance' | 'degraded';

export type MaintenancePriority = 'routine' | 'urgent' | 'emergency';

export type Zone = 'North' | 'South' | 'East' | 'West' | 'Central';

// ─────────────────────────────────────────────────────────────────────────────
// Asset
// ─────────────────────────────────────────────────────────────────────────────

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface SensorReading {
  timestamp: string; // ISO-8601
  temperature_c: number;
  vibration_mm_s: number;
  partial_discharge_mv: number;
  oil_quality_index: number; // 0–100, higher = better
  load_percent: number;
}

export interface ShapFactor {
  name: string;
  value: number; // contribution in percentage points (positive = increases risk)
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  location: GeoCoordinate;
  zone: Zone;
  /** @deprecated use zone */
  region: string;
  install_year: number;
  age_years: number;
  risk_score: number; // 0–100
  risk_level: RiskLevel;
  customers_served: number;
  last_inspected: string; // ISO date
  last_maintenance: string; // ISO date
  next_maintenance: string; // ISO date
  sensor_readings: SensorReading[];
  failure_probability_7d: number; // 0–1
  failure_probability_30d: number; // 0–1
  weather_risk_factor: number; // 0–1
  shap_factors: ShapFactor[];
  notes: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance
// ─────────────────────────────────────────────────────────────────────────────

export interface MaintenanceTask {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_type: AssetType;
  zone: Zone;
  priority: MaintenancePriority;
  risk_level: RiskLevel;
  scheduled_date: string; // ISO date
  action: string;
  estimated_duration_hours: number;
  assigned_team: string;
  description: string;
  estimated_cost_usd: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'deferred';
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard summary
// ─────────────────────────────────────────────────────────────────────────────

export interface GridSummary {
  total_assets: number;
  online: number;
  offline: number;
  maintenance: number;
  degraded: number;
  critical_risk_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  outage_risk_24h: number; // 0–1 probability
  avg_risk_score: number;
  pending_maintenance_tasks: number;
  maintenance_today: number;
  last_updated: string; // ISO-8601
}

// ─────────────────────────────────────────────────────────────────────────────
// App / UI state
// ─────────────────────────────────────────────────────────────────────────────

export interface AppFilters {
  risk_level: RiskLevel | 'all';
  asset_type: AssetType | 'all';
  zone: Zone | 'all';
  status: AssetStatus | 'all';
}
