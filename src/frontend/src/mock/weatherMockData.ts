import type { RiskLevel, Zone } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Weather types
// ─────────────────────────────────────────────────────────────────────────────

export type WeatherCondition =
  | 'clear' | 'partly_cloudy' | 'cloudy' | 'overcast'
  | 'light_rain' | 'heavy_rain' | 'thunderstorm' | 'fog'
  | 'hot' | 'windy' | 'hail';

export type ForecastRange = '24h' | '3d' | '7d';

export interface CurrentWeather {
  condition: WeatherCondition;
  temperature_c: number;
  feels_like_c: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  wind_direction: string;
  rain_probability_pct: number;
  precipitation_mm: number;
  visibility_km: number;
  uv_index: number;
  pressure_hpa: number;
  last_updated: string; // ISO
}

export interface ForecastPeriod {
  datetime: string;      // ISO
  label: string;         // "Today 3PM", "Tomorrow", "Wed Jun 5"
  condition: WeatherCondition;
  temp_high_c: number;
  temp_low_c: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  rain_probability_pct: number;
  precipitation_mm: number;
  severity: RiskLevel;   // how severe this period is for grid equipment
}

export interface WeatherRiskIndicator {
  id: string;
  label: string;
  level: RiskLevel;
  score: number;   // 0-100
  explanation: string;
  grid_impact: string;
}

export interface ZoneWeatherStatus {
  zone: Zone;
  condition: WeatherCondition;
  temperature_c: number;
  weather_risk: RiskLevel;
  affected_assets: number;
  highest_asset_risk: RiskLevel;
  recommended_action: string;
}

export interface WeatherAssetRisk {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  zone: Zone;
  sensor_risk: RiskLevel;
  sensor_risk_score: number;
  weather_risk: RiskLevel;
  weather_risk_score: number;
  combined_risk: RiskLevel;
  combined_risk_score: number;
  main_factor: string;
  recommendation: string;
  sensor_temp_c: number;
  sensor_vibration: number;
  sensor_oil_quality: number;
  sensor_partial_discharge: number;
  weather_impact: string;
}

export interface WeatherRecommendation {
  id: string;
  priority: RiskLevel;
  asset_id: string;
  asset_name: string;
  zone: Zone;
  reason: string;
  action: string;
  suggested_time: string;
  status: 'pending' | 'acknowledged' | 'actioned';
}

export interface TimelinePoint {
  time: string;
  weather_severity: number;   // 0-100
  sensor_risk: number;        // 0-100
  combined_risk: number;      // 0-100
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather icon mapping (emoji fallback — no external dependency)
// ─────────────────────────────────────────────────────────────────────────────

export const weatherEmoji: Record<WeatherCondition, string> = {
  clear:         '☀️',
  partly_cloudy: '⛅',
  cloudy:        '☁️',
  overcast:      '🌫️',
  light_rain:    '🌦️',
  heavy_rain:    '🌧️',
  thunderstorm:  '⛈️',
  fog:           '🌁',
  hot:           '🌡️',
  windy:         '💨',
  hail:          '🌨️',
};

export const weatherLabel: Record<WeatherCondition, string> = {
  clear:         'Clear',
  partly_cloudy: 'Partly Cloudy',
  cloudy:        'Cloudy',
  overcast:      'Overcast',
  light_rain:    'Light Rain',
  heavy_rain:    'Heavy Rain',
  thunderstorm:  'Thunderstorm',
  fog:           'Fog',
  hot:           'Extreme Heat',
  windy:         'High Winds',
  hail:          'Hail',
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

export const mockCurrentWeather: CurrentWeather = {
  condition: 'hot',
  temperature_c: 38.4,
  feels_like_c: 43.1,
  humidity_pct: 71,
  wind_speed_kmh: 22,
  wind_direction: 'SW',
  rain_probability_pct: 15,
  precipitation_mm: 0,
  visibility_km: 14.2,
  uv_index: 9,
  pressure_hpa: 1008,
  last_updated: new Date().toISOString(),
};

// ─── 7-day forecast ───────────────────────────────────────────────────────────

function forecastDate(offsetHours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + offsetHours);
  return d.toISOString();
}

function forecastLabel(offsetHours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + offsetHours);
  const now = new Date();
  const diffDays = Math.round((d.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86400000);
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  if (diffDays === 0) return `Today ${new Date(forecastDate(offsetHours)).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}`;
  if (diffDays === 1) return 'Tomorrow';
  return dayNames[d.getDay()] + ' ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const mockForecast: ForecastPeriod[] = [
  {
    datetime: forecastDate(0),   label: forecastLabel(0),
    condition: 'hot',            temp_high_c: 38, temp_low_c: 31,
    humidity_pct: 71,            wind_speed_kmh: 22,
    rain_probability_pct: 10,   precipitation_mm: 0,     severity: 'high',
  },
  {
    datetime: forecastDate(6),   label: forecastLabel(6),
    condition: 'hot',            temp_high_c: 40, temp_low_c: 33,
    humidity_pct: 68,            wind_speed_kmh: 18,
    rain_probability_pct: 5,    precipitation_mm: 0,     severity: 'critical',
  },
  {
    datetime: forecastDate(12),  label: forecastLabel(12),
    condition: 'partly_cloudy',  temp_high_c: 36, temp_low_c: 29,
    humidity_pct: 65,            wind_speed_kmh: 25,
    rain_probability_pct: 20,   precipitation_mm: 0.2,   severity: 'high',
  },
  {
    datetime: forecastDate(18),  label: forecastLabel(18),
    condition: 'thunderstorm',   temp_high_c: 29, temp_low_c: 24,
    humidity_pct: 88,            wind_speed_kmh: 55,
    rain_probability_pct: 90,   precipitation_mm: 18.5,  severity: 'critical',
  },
  {
    datetime: forecastDate(24),  label: forecastLabel(24),
    condition: 'heavy_rain',     temp_high_c: 26, temp_low_c: 22,
    humidity_pct: 92,            wind_speed_kmh: 42,
    rain_probability_pct: 80,   precipitation_mm: 31.0,  severity: 'critical',
  },
  {
    datetime: forecastDate(48),  label: forecastLabel(48),
    condition: 'light_rain',     temp_high_c: 28, temp_low_c: 21,
    humidity_pct: 78,            wind_speed_kmh: 28,
    rain_probability_pct: 55,   precipitation_mm: 8.5,   severity: 'high',
  },
  {
    datetime: forecastDate(72),  label: forecastLabel(72),
    condition: 'cloudy',         temp_high_c: 30, temp_low_c: 22,
    humidity_pct: 70,            wind_speed_kmh: 20,
    rain_probability_pct: 30,   precipitation_mm: 2.0,   severity: 'medium',
  },
  {
    datetime: forecastDate(96),  label: forecastLabel(96),
    condition: 'partly_cloudy',  temp_high_c: 32, temp_low_c: 24,
    humidity_pct: 60,            wind_speed_kmh: 15,
    rain_probability_pct: 15,   precipitation_mm: 0,     severity: 'medium',
  },
  {
    datetime: forecastDate(120), label: forecastLabel(120),
    condition: 'clear',          temp_high_c: 33, temp_low_c: 25,
    humidity_pct: 55,            wind_speed_kmh: 12,
    rain_probability_pct: 5,    precipitation_mm: 0,     severity: 'low',
  },
  {
    datetime: forecastDate(144), label: forecastLabel(144),
    condition: 'clear',          temp_high_c: 35, temp_low_c: 27,
    humidity_pct: 50,            wind_speed_kmh: 10,
    rain_probability_pct: 5,    precipitation_mm: 0,     severity: 'low',
  },
];

// ─── Weather risk indicators ──────────────────────────────────────────────────

export const mockWeatherRisks: WeatherRiskIndicator[] = [
  {
    id: 'heat',
    label: 'Heat Stress',
    level: 'critical',
    score: 91,
    explanation: 'Extreme heat forecast at 40°C. Heat index reaches dangerous levels for field crews and transformers.',
    grid_impact: 'Transformer cooling systems at risk of failure. Oil viscosity drops under extreme heat, accelerating insulation degradation.',
  },
  {
    id: 'rain',
    label: 'Heavy Rain Risk',
    level: 'critical',
    score: 88,
    explanation: '31mm precipitation forecast in next 24h. Thunderstorm with 90% probability late today.',
    grid_impact: 'Substation flooding risk in low-lying zones. Electrical arcing risk in exposed switchgear. Inspect drainage before storm.',
  },
  {
    id: 'wind',
    label: 'Wind Risk',
    level: 'high',
    score: 74,
    explanation: 'Wind gusts up to 55 km/h during thunderstorm window. Sustained 22 km/h winds today.',
    grid_impact: 'Transmission line sag increases under wind loading. Vibration-sensitive equipment requires monitoring. Restrict tower work.',
  },
  {
    id: 'lightning',
    label: 'Lightning Risk',
    level: 'high',
    score: 72,
    explanation: 'Thunderstorm forecast this evening with high lightning activity. Lightning density: 4.2 strikes/km²/hr.',
    grid_impact: 'Surge protection may be overwhelmed. Lightning arresters should be tested. Field work must cease during storm window.',
  },
  {
    id: 'flooding',
    label: 'Flooding Risk',
    level: 'medium',
    score: 58,
    explanation: '31mm rain on saturated ground raises flooding probability. Two low-lying substations in flood-prone areas.',
    grid_impact: 'East and South zone substations may experience groundwater intrusion. Pre-position pumping equipment.',
  },
];

// ─── Zone weather status ─────────────────────────────────────────────────────

export const mockZoneWeather: ZoneWeatherStatus[] = [
  {
    zone: 'North',
    condition: 'hot',
    temperature_c: 39.1,
    weather_risk: 'critical',
    affected_assets: 6,
    highest_asset_risk: 'critical',
    recommended_action: 'Emergency inspection of TRF-042. Reduce loads on all North transformers by 15%.',
  },
  {
    zone: 'East',
    condition: 'thunderstorm',
    temperature_c: 31.2,
    weather_risk: 'critical',
    affected_assets: 5,
    highest_asset_risk: 'critical',
    recommended_action: 'Cease all field work during storm window. Inspect SUB-021 drainage pre-storm.',
  },
  {
    zone: 'West',
    condition: 'hot',
    temperature_c: 37.8,
    weather_risk: 'high',
    affected_assets: 5,
    highest_asset_risk: 'critical',
    recommended_action: 'Schedule TRF-103 cooling inspection. Monitor CAP-012 under heat load.',
  },
  {
    zone: 'South',
    condition: 'heavy_rain',
    temperature_c: 27.4,
    weather_risk: 'high',
    affected_assets: 4,
    highest_asset_risk: 'critical',
    recommended_action: 'Check drainage at SUB-009. Inspect coastal transformer TRF-019 insulation post-rain.',
  },
  {
    zone: 'Central',
    condition: 'partly_cloudy',
    temperature_c: 33.5,
    weather_risk: 'medium',
    affected_assets: 5,
    highest_asset_risk: 'high',
    recommended_action: 'Monitor CB-017 under increased load. Standard precautions apply.',
  },
];

// ─── Weather-aware asset risk ─────────────────────────────────────────────────

export const mockWeatherAssetRisks: WeatherAssetRisk[] = [
  {
    asset_id: 'TRF-042',
    asset_name: 'North Main Transformer Alpha',
    asset_type: 'transformer',
    zone: 'North',
    sensor_risk: 'critical', sensor_risk_score: 94,
    weather_risk: 'critical', weather_risk_score: 88,
    combined_risk: 'critical', combined_risk_score: 98,
    main_factor: 'Extreme heat (40°C) + oil temperature already at 98°C sensor reading',
    recommendation: 'Immediate cooling system inspection. Reduce load to 70%. Emergency crew dispatch.',
    sensor_temp_c: 98.4, sensor_vibration: 3.1, sensor_oil_quality: 22, sensor_partial_discharge: 520,
    weather_impact: 'Heat will accelerate thermal degradation. Risk of thermal runaway within 6–12h.',
  },
  {
    asset_id: 'SUB-021',
    asset_name: 'East Industrial Substation',
    asset_type: 'substation',
    zone: 'East',
    sensor_risk: 'critical', sensor_risk_score: 91,
    weather_risk: 'critical', weather_risk_score: 85,
    combined_risk: 'critical', combined_risk_score: 97,
    main_factor: 'Thunderstorm imminent + bushing already failed (offline)',
    recommendation: 'Do not re-energize before storm passes. Ensure drainage clear. Waterproof temporary covers.',
    sensor_temp_c: 104.2, sensor_vibration: 3.4, sensor_oil_quality: 18, sensor_partial_discharge: 560,
    weather_impact: 'Storm increases risk of secondary failures and personnel safety incidents.',
  },
  {
    asset_id: 'TRF-103',
    asset_name: 'West Central Transformer Beta',
    asset_type: 'transformer',
    zone: 'West',
    sensor_risk: 'critical', sensor_risk_score: 87,
    weather_risk: 'high', weather_risk_score: 76,
    combined_risk: 'critical', combined_risk_score: 93,
    main_factor: 'High ambient temperature + deteriorated oil quality at 27/100 index',
    recommendation: 'Advance oil analysis. Install temporary cooling fan before afternoon peak temperature.',
    sensor_temp_c: 94.1, sensor_vibration: 2.8, sensor_oil_quality: 27, sensor_partial_discharge: 490,
    weather_impact: 'Heat forecast raises effective risk by +6 points. Accelerated insulation ageing.',
  },
  {
    asset_id: 'TRF-077',
    asset_name: 'North Industrial Transformer',
    asset_type: 'transformer',
    zone: 'North',
    sensor_risk: 'high', sensor_risk_score: 78,
    weather_risk: 'critical', weather_risk_score: 88,
    combined_risk: 'critical', combined_risk_score: 91,
    main_factor: 'Cooling fin blockage + extreme heat forecast 40°C',
    recommendation: 'Move cooling system repair to TODAY. Cannot defer under extreme heat conditions.',
    sensor_temp_c: 85.2, sensor_vibration: 2.2, sensor_oil_quality: 40, sensor_partial_discharge: 380,
    weather_impact: 'Current heat conditions push this HIGH sensor-risk asset into CRITICAL territory.',
  },
  {
    asset_id: 'SUB-009',
    asset_name: 'South Distribution Substation',
    asset_type: 'substation',
    zone: 'South',
    sensor_risk: 'high', sensor_risk_score: 72,
    weather_risk: 'high', weather_risk_score: 74,
    combined_risk: 'high', combined_risk_score: 84,
    main_factor: 'Heavy rain forecast + low-lying location with prior drainage issues',
    recommendation: 'Pre-storm drainage inspection. Pre-position sandbags at cable entry points.',
    sensor_temp_c: 81.0, sensor_vibration: 1.8, sensor_oil_quality: 46, sensor_partial_discharge: 320,
    weather_impact: '31mm rain on pre-saturated ground elevates flooding risk at this location.',
  },
  {
    asset_id: 'TL-004',
    asset_name: 'East Transmission Line 4',
    asset_type: 'transmission_line',
    zone: 'East',
    sensor_risk: 'medium', sensor_risk_score: 58,
    weather_risk: 'high', weather_risk_score: 74,
    combined_risk: 'high', combined_risk_score: 78,
    main_factor: 'Pre-existing sag on span 3 + 55 km/h gusts forecast during thunderstorm',
    recommendation: 'Defer storm prep inspection to before storm window (before 18:00 today).',
    sensor_temp_c: 68.0, sensor_vibration: 1.2, sensor_oil_quality: 64, sensor_partial_discharge: 190,
    weather_impact: 'Wind loading combined with existing sag raises galloping conductor risk.',
  },
  {
    asset_id: 'CAP-012',
    asset_name: 'West Capacitor Bank 12',
    asset_type: 'capacitor_bank',
    zone: 'West',
    sensor_risk: 'medium', sensor_risk_score: 54,
    weather_risk: 'medium', weather_risk_score: 58,
    combined_risk: 'medium', combined_risk_score: 64,
    main_factor: 'Capacitance drift + moderate heat load expected',
    recommendation: 'Monitor reactive power output. Inspect vent covers before rain.',
    sensor_temp_c: 66.0, sensor_vibration: 1.1, sensor_oil_quality: 66, sensor_partial_discharge: 175,
    weather_impact: 'Heat increases dielectric stress. Minor risk elevation.',
  },
  {
    asset_id: 'TRF-088',
    asset_name: 'East Smart Grid Transformer',
    asset_type: 'transformer',
    zone: 'East',
    sensor_risk: 'low', sensor_risk_score: 19,
    weather_risk: 'high', weather_risk_score: 72,
    combined_risk: 'medium', combined_risk_score: 55,
    main_factor: 'Good sensor health but located in thunderstorm zone',
    recommendation: 'Monitor surge protection status. Verify lightning arresters operational.',
    sensor_temp_c: 54.0, sensor_vibration: 0.3, sensor_oil_quality: 91, sensor_partial_discharge: 42,
    weather_impact: 'Low sensor risk, but thunderstorm brings external threat. Surge risk is primary concern.',
  },
];

// ─── Weather-adjusted recommendations ────────────────────────────────────────

export const mockWeatherRecommendations: WeatherRecommendation[] = [
  {
    id: 'WR-001',
    priority: 'critical',
    asset_id: 'TRF-042',
    asset_name: 'North Main Transformer Alpha',
    zone: 'North',
    reason: 'Extreme heat forecast (40°C peak) combined with 98°C oil temperature and degraded cooling performance.',
    action: 'Dispatch emergency crew immediately. Install temporary auxiliary cooling fans. Reduce transformer load to 70%.',
    suggested_time: 'Immediately — within 2 hours',
    status: 'pending',
  },
  {
    id: 'WR-002',
    priority: 'critical',
    asset_id: 'TRF-077',
    asset_name: 'North Industrial Transformer',
    zone: 'North',
    reason: 'Blocked cooling fins cannot handle forecasted 40°C ambient temperature. Risk escalates to critical.',
    action: 'Move scheduled cooling system repair from next week to TODAY before 14:00.',
    suggested_time: 'Today before 14:00',
    status: 'pending',
  },
  {
    id: 'WR-003',
    priority: 'critical',
    asset_id: 'SUB-021',
    asset_name: 'East Industrial Substation',
    zone: 'East',
    reason: 'Thunderstorm forecast. Asset already offline. Risk of secondary failures during storm.',
    action: 'Verify all temporary covers waterproof. Check drainage. Do not restore power before storm passes.',
    suggested_time: 'Before 18:00 today',
    status: 'pending',
  },
  {
    id: 'WR-004',
    priority: 'high',
    asset_id: 'SUB-009',
    asset_name: 'South Distribution Substation',
    zone: 'South',
    reason: 'Heavy rainfall (31mm) forecast on saturated ground. Low-lying location with historical drainage issues.',
    action: 'Pre-storm drainage inspection and sandbag deployment at cable trenches.',
    suggested_time: 'Before 17:00 today',
    status: 'pending',
  },
  {
    id: 'WR-005',
    priority: 'high',
    asset_id: 'TL-004',
    asset_name: 'East Transmission Line 4',
    zone: 'East',
    reason: 'Pre-existing sag combined with 55 km/h wind gusts increases galloping conductor risk.',
    action: 'Complete storm prep inspection before storm window. Document sag measurements.',
    suggested_time: 'Before 17:30 today',
    status: 'acknowledged',
  },
  {
    id: 'WR-006',
    priority: 'high',
    asset_id: 'ALL',
    asset_name: 'All East Zone Assets',
    zone: 'East',
    reason: 'Thunderstorm with lightning approaching East Zone. Field crew safety risk.',
    action: 'Cease all outdoor field work in East Zone from 18:00 until storm passes.',
    suggested_time: 'Effective 18:00 today',
    status: 'acknowledged',
  },
  {
    id: 'WR-007',
    priority: 'medium',
    asset_id: 'TRF-088',
    asset_name: 'East Smart Grid Transformer',
    zone: 'East',
    reason: 'Thunderstorm in East Zone may cause surge events. Good sensor health but needs surge verification.',
    action: 'Verify lightning arrester status and surge protection relay settings.',
    suggested_time: 'Today before storm window',
    status: 'pending',
  },
  {
    id: 'WR-008',
    priority: 'medium',
    asset_id: 'ALL',
    asset_name: 'All North Zone Transformers',
    zone: 'North',
    reason: 'Heat wave forecast. General precautionary reduction of transformer loading recommended.',
    action: 'Reduce North Zone transformer loads by 10–15% during peak temperature (13:00–17:00).',
    suggested_time: '13:00–17:00 today',
    status: 'pending',
  },
];

// ─── Weather impact timeline ──────────────────────────────────────────────────

export const mockTimeline: TimelinePoint[] = [
  { time: '06:00', label: '6AM',  weather_severity: 55, sensor_risk: 72, combined_risk: 76 },
  { time: '08:00', label: '8AM',  weather_severity: 62, sensor_risk: 74, combined_risk: 80 },
  { time: '10:00', label: '10AM', weather_severity: 74, sensor_risk: 76, combined_risk: 85 },
  { time: '12:00', label: '12PM', weather_severity: 85, sensor_risk: 78, combined_risk: 91 },
  { time: '14:00', label: '2PM',  weather_severity: 92, sensor_risk: 80, combined_risk: 94 },
  { time: '16:00', label: '4PM',  weather_severity: 88, sensor_risk: 81, combined_risk: 93 },
  { time: '18:00', label: '6PM',  weather_severity: 96, sensor_risk: 83, combined_risk: 98 },
  { time: '20:00', label: '8PM',  weather_severity: 88, sensor_risk: 79, combined_risk: 90 },
  { time: '22:00', label: '10PM', weather_severity: 72, sensor_risk: 77, combined_risk: 84 },
  { time: '00:00', label: '12AM', weather_severity: 64, sensor_risk: 75, combined_risk: 80 },
  { time: '02:00', label: '2AM',  weather_severity: 58, sensor_risk: 74, combined_risk: 76 },
  { time: '04:00', label: '4AM',  weather_severity: 52, sensor_risk: 73, combined_risk: 74 },
  { time: '+6AM',  label: '+6AM', weather_severity: 60, sensor_risk: 74, combined_risk: 78 },
  { time: '+8AM',  label: '+8AM', weather_severity: 78, sensor_risk: 76, combined_risk: 85 },
  { time: '+12PM', label: '+12PM',weather_severity: 82, sensor_risk: 77, combined_risk: 88 },
];

// ─── Precautionary measures ───────────────────────────────────────────────────

export interface PrecautionGroup {
  id: string;
  label: string;
  icon: string;
  color: string;
  items: string[];
}

export const mockPrecautions: PrecautionGroup[] = [
  {
    id: 'heat',
    label: 'Heat',
    icon: '🌡️',
    color: 'text-red-400',
    items: [
      'Check transformer cooling systems — fans and radiators operational.',
      'Monitor oil temperature continuously on high-risk transformers.',
      'Reduce transformer loading by 10–15% during peak heat hours (13:00–17:00).',
      'Prioritize inspection of assets with oil quality below 40/100.',
      'Ensure auxiliary cooling fans are available for critical assets.',
      'Restrict personnel from outdoor work during peak UV index (10:00–15:00).',
    ],
  },
  {
    id: 'rain',
    label: 'Rain & Storm',
    icon: '🌧️',
    color: 'text-blue-400',
    items: [
      'Inspect exposed equipment and seal exposed cable entry points.',
      'Check drainage around all substations before storm arrives.',
      'Avoid unnecessary outdoor field work during severe rainfall.',
      'Verify seals on all junction boxes and outdoor panels.',
      'Pre-position portable pumps at flood-prone substations.',
      'Defer maintenance work that requires open transformer lids.',
    ],
  },
  {
    id: 'wind',
    label: 'High Winds',
    icon: '💨',
    color: 'text-cyan-400',
    items: [
      'Inspect transmission lines and towers for structural integrity.',
      'Monitor vibration sensors — elevated readings expected during high winds.',
      'Secure all loose materials and equipment near substations.',
      'Restrict tower climbing above 15m during wind gusts over 40 km/h.',
      'Check conductor sag clearances before wind event.',
      'Prepare field crews for potential conductor galloping events.',
    ],
  },
  {
    id: 'lightning',
    label: 'Lightning',
    icon: '⚡',
    color: 'text-yellow-400',
    items: [
      'Monitor lightning density in high-risk zones (East and North).',
      'Test surge protection systems before storm window.',
      'Verify all lightning arrester connections.',
      'Review protection relay settings for fast trip under surge conditions.',
      'Restrict ALL outdoor field work once lightning is within 15km.',
      'Activate SCADA remote monitoring and reduce personnel on-site.',
    ],
  },
];
