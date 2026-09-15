import type { RiskLevel, AssetType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Calendar-specific types
// ─────────────────────────────────────────────────────────────────────────────

export type CalTaskStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue';

export type CalZone = 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D';
export type CalCrew = 'Crew Alpha' | 'Crew Beta' | 'Crew Gamma' | 'Crew Delta';

export interface CalendarTask {
  id: string;
  title: string;
  asset_id: string;
  asset_name: string;
  asset_type: AssetType;
  zone: CalZone;
  risk_level: RiskLevel;
  risk_score: number;
  priority: 'emergency' | 'urgent' | 'routine';
  status: CalTaskStatus;
  date: string;           // YYYY-MM-DD
  start_time: string;     // HH:MM
  end_time: string;       // HH:MM
  duration_hours: number;
  assigned_team: CalCrew;
  technician: string;
  maintenance_type: string;
  description: string;
  action: string;
  last_inspection: string;
  customers_affected: number;
  precautions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 15 realistic tasks for September 2026 — fixed dates matching reference image
// ─────────────────────────────────────────────────────────────────────────────

export const calendarTasks: CalendarTask[] = [
  // ── September 5 (Sat) — LOW ───────────────────────────────────────────────
  {
    id: 'CAL-015',
    title: 'Smart Sensor Firmware Update',
    asset_id: 'TRF-088',
    asset_name: 'East Smart Grid Transformer',
    asset_type: 'transformer',
    zone: 'Zone A',
    risk_level: 'low',
    risk_score: 19,
    priority: 'routine',
    status: 'completed',
    date: '2026-09-05',
    start_time: '09:00',
    end_time: '11:00',
    duration_hours: 2,
    assigned_team: 'Crew Beta',
    technician: 'L. Park',
    maintenance_type: 'Software Update',
    description: 'Firmware v3.2.1 deployment to all IoT sensors. New anomaly detection algorithms.',
    action: 'OTA firmware push, sensor reboot, validation tests',
    last_inspection: '2026-08-28',
    customers_affected: 3000,
    precautions: [
      'Maintain manual monitoring during sensor reboot window',
    ],
  },

  // ── September 8 (Tue) — MEDIUM ────────────────────────────────────────────
  {
    id: 'CAL-014',
    title: 'Annual Battery & UPS Inspection',
    asset_id: 'SUB-045',
    asset_name: 'East Residential Substation',
    asset_type: 'substation',
    zone: 'Zone B',
    risk_level: 'medium',
    risk_score: 38,
    priority: 'routine',
    status: 'completed',
    date: '2026-09-08',
    start_time: '10:00',
    end_time: '12:00',
    duration_hours: 2,
    assigned_team: 'Crew Alpha',
    technician: 'T. Brown',
    maintenance_type: 'Compliance Testing',
    description: 'Annual UPS battery capacity test and backup power system inspection.',
    action: 'Battery load test, UPS output verification, clean terminals',
    last_inspection: '2026-08-01',
    customers_affected: 3200,
    precautions: [
      'Ensure backup generator is available during UPS test',
    ],
  },

  // ── September 13 (Sun) — CRITICAL ────────────────────────────────────────
  {
    id: 'CAL-006',
    title: 'Full Mechanical Inspection',
    asset_id: 'CB-008',
    asset_name: 'East Circuit Breaker Array 8',
    asset_type: 'circuit_breaker',
    zone: 'Zone C',
    risk_level: 'critical',
    risk_score: 71,
    priority: 'urgent',
    status: 'in_progress',
    date: '2026-09-13',
    start_time: '09:00',
    end_time: '12:00',
    duration_hours: 3,
    assigned_team: 'Crew Alpha',
    technician: 'R. Okafor',
    maintenance_type: 'Preventive Maintenance',
    description: 'Full mechanical inspection, contact cleaning, and trip testing. Currently in progress.',
    action: 'Contact cleaning, mechanism lubrication, trip and close tests',
    last_inspection: '2026-09-05',
    customers_affected: 2100,
    precautions: [
      'Ensure backup protection active during maintenance window',
    ],
  },

  // ── September 14 (Mon) — HIGH ────────────────────────────────────────────
  {
    id: 'CAL-013',
    title: 'Storm Preparation Inspection',
    asset_id: 'TL-004',
    asset_name: 'East Transmission Line 4',
    asset_type: 'transmission_line',
    zone: 'Zone D',
    risk_level: 'high',
    risk_score: 58,
    priority: 'urgent',
    status: 'scheduled',
    date: '2026-09-14',
    start_time: '09:00',
    end_time: '11:00',
    duration_hours: 2,
    assigned_team: 'Crew Gamma',
    technician: 'H. Johnson',
    maintenance_type: 'Preventive Inspection',
    description: 'Pre-storm structural inspection. Moderate sag detected on span 3. High wind forecast.',
    action: 'Tower footing inspection, sag measurement, hardware check',
    last_inspection: '2026-07-27',
    customers_affected: 1800,
    precautions: [
      'Helicopter inspection required for high towers',
      'Ground teams must maintain 10m clearance from energized spans',
    ],
  },

  // ── September 15 (Tue) — CRITICAL — current date ─────────────────────────
  {
    id: 'CAL-001',
    title: 'Emergency Bushing Replacement',
    asset_id: 'SUB-021',
    asset_name: 'East Industrial Substation',
    asset_type: 'substation',
    zone: 'Zone A',
    risk_level: 'critical',
    risk_score: 91,
    priority: 'emergency',
    status: 'in_progress',
    date: '2026-09-15',
    start_time: '13:00',
    end_time: '17:00',
    duration_hours: 4,
    assigned_team: 'Crew Alpha',
    technician: 'J. Ramirez',
    maintenance_type: 'Emergency Repair',
    description: 'Replace failed high-voltage bushing on Bay 3. Asset offline. Full electrical re-commissioning required after repair.',
    action: 'Replace bushing, perform HV testing, restore power sequencing',
    last_inspection: '2026-09-11',
    customers_affected: 5100,
    precautions: [
      'De-energize all adjacent bays before work begins',
      'Mandatory arc-flash PPE level 4',
      'Two-person rule enforced throughout',
      'Notify downstream substations before restore',
    ],
  },

  // ── September 16 (Wed) — CRITICAL × 2 ────────────────────────────────────
  {
    id: 'CAL-002',
    title: 'Thermal Inspection & Oil Replacement',
    asset_id: 'TRF-042',
    asset_name: 'North Main Transformer Alpha',
    asset_type: 'transformer',
    zone: 'Zone B',
    risk_level: 'critical',
    risk_score: 94,
    priority: 'emergency',
    status: 'scheduled',
    date: '2026-09-16',
    start_time: '09:00',
    end_time: '12:00',
    duration_hours: 3,
    assigned_team: 'Crew Beta',
    technician: 'M. Chen',
    maintenance_type: 'Emergency Inspection',
    description: 'Thermal runaway risk detected. Complete oil drain and refill with certified fluid. Full bushing assessment.',
    action: 'Oil replacement, thermal scan, bushing check, partial discharge test',
    last_inspection: '2026-07-25',
    customers_affected: 4200,
    precautions: [
      'Ensure load transfer complete before shutdown',
      'Oil disposal per EPA guidelines',
      'Infrared camera required for thermal scan',
    ],
  },
  {
    id: 'CAL-003',
    title: 'Emergency Thermal Inspection',
    asset_id: 'TRF-091',
    asset_name: 'South Grid Transformer Gamma',
    asset_type: 'transformer',
    zone: 'Zone C',
    risk_level: 'critical',
    risk_score: 89,
    priority: 'emergency',
    status: 'scheduled',
    date: '2026-09-16',
    start_time: '14:00',
    end_time: '16:00',
    duration_hours: 2,
    assigned_team: 'Crew Alpha',
    technician: 'D. Patel',
    maintenance_type: 'Emergency Inspection',
    description: 'Asset offline. Restore transformer after full thermal and insulation diagnostic.',
    action: 'Thermal inspection, insulation resistance test, system restore',
    last_inspection: '2026-09-10',
    customers_affected: 3600,
    precautions: [
      'Verify load distribution before re-energizing',
      'Monitor temp sensors continuously during restore',
    ],
  },

  // ── September 18 (Fri) — HIGH × 2 ────────────────────────────────────────
  {
    id: 'CAL-004',
    title: 'Insulation Testing & Oil Analysis',
    asset_id: 'TRF-103',
    asset_name: 'West Central Transformer Beta',
    asset_type: 'transformer',
    zone: 'Zone D',
    risk_level: 'high',
    risk_score: 87,
    priority: 'urgent',
    status: 'scheduled',
    date: '2026-09-18',
    start_time: '09:00',
    end_time: '12:00',
    duration_hours: 3,
    assigned_team: 'Crew Gamma',
    technician: 'A. Singh',
    maintenance_type: 'Diagnostic',
    description: 'Severe insulation degradation trend. Oil sample shows contamination. Partial discharge mitigation required.',
    action: 'PD mitigation, insulation resistance test, dissolved gas analysis',
    last_inspection: '2026-07-29',
    customers_affected: 3800,
    precautions: [
      'Perform DGA test first before energizing',
      'Limit loads to 70% during post-maintenance monitoring',
    ],
  },
  {
    id: 'CAL-005',
    title: 'Arc Contact Replacement',
    asset_id: 'CB-017',
    asset_name: 'Central Circuit Breaker 17',
    asset_type: 'circuit_breaker',
    zone: 'Zone A',
    risk_level: 'high',
    risk_score: 86,
    priority: 'urgent',
    status: 'scheduled',
    date: '2026-09-18',
    start_time: '13:00',
    end_time: '16:00',
    duration_hours: 3,
    assigned_team: 'Crew Delta',
    technician: 'K. Williams',
    maintenance_type: 'Component Replacement',
    description: 'Arcing detected in main contacts. Contact wear exceeds 80% threshold. Replace arc chambers.',
    action: 'Contact replacement, mechanical inspection, trip test',
    last_inspection: '2026-09-05',
    customers_affected: 2900,
    precautions: [
      'Verify breaker is fully locked out before contact removal',
      'Test trip mechanism 3x after installation',
    ],
  },

  // ── September 22 (Tue) — MEDIUM ──────────────────────────────────────────
  {
    id: 'CAL-007',
    title: 'Cooling System Repair',
    asset_id: 'TRF-077',
    asset_name: 'North Industrial Transformer',
    asset_type: 'transformer',
    zone: 'Zone B',
    risk_level: 'medium',
    risk_score: 78,
    priority: 'urgent',
    status: 'scheduled',
    date: '2026-09-22',
    start_time: '09:00',
    end_time: '13:00',
    duration_hours: 4,
    assigned_team: 'Crew Beta',
    technician: 'S. Torres',
    maintenance_type: 'Corrective Maintenance',
    description: 'Cooling fin obstruction reducing thermal efficiency. Fan unit B2 operating at reduced capacity.',
    action: 'Clean radiators, inspect fan motors, repair cooling fins',
    last_inspection: '2026-08-18',
    customers_affected: 3100,
    precautions: [
      'Monitor winding temperature during operation',
      'Do not exceed 85°C during maintenance window',
    ],
  },

  // ── September 25 (Fri) — MEDIUM ──────────────────────────────────────────
  {
    id: 'CAL-016',
    title: 'Insulation Cleaning — Coastal Zone',
    asset_id: 'TRF-019',
    asset_name: 'South Coastal Transformer',
    asset_type: 'transformer',
    zone: 'Zone C',
    risk_level: 'medium',
    risk_score: 51,
    priority: 'routine',
    status: 'scheduled',
    date: '2026-09-25',
    start_time: '08:00',
    end_time: '11:00',
    duration_hours: 3,
    assigned_team: 'Crew Gamma',
    technician: 'E. Santos',
    maintenance_type: 'Preventive Maintenance',
    description: 'Salt contamination on bushings and insulators near coastal exposure zone.',
    action: 'Dry cleaning of insulators, silicone grease application, visual inspection',
    last_inspection: '2026-08-28',
    customers_affected: 2200,
    precautions: [
      'Use dry-cleaning methods only — no water near energized equipment',
      'Check weather — avoid windy conditions during application',
    ],
  },

  // ── September 29 (Tue) — MEDIUM + LOW ─────────────────────────────────────
  {
    id: 'CAL-008',
    title: 'Thermal Imaging & PD Mitigation',
    asset_id: 'TRF-055',
    asset_name: 'West Grid Transformer Delta',
    asset_type: 'transformer',
    zone: 'Zone D',
    risk_level: 'medium',
    risk_score: 74,
    priority: 'routine',
    status: 'scheduled',
    date: '2026-09-29',
    start_time: '09:00',
    end_time: '12:00',
    duration_hours: 3,
    assigned_team: 'Crew Delta',
    technician: 'F. Li',
    maintenance_type: 'Predictive Maintenance',
    description: 'Elevated PD trend over 2 weeks. Thermal imaging scan to identify hotspots. PD mitigation required.',
    action: 'Thermal imaging scan, partial discharge mapping, mitigation work',
    last_inspection: '2026-08-11',
    customers_affected: 2700,
    precautions: [
      'Coordinate with grid control for load reduction during scan',
    ],
  },
  {
    id: 'CAL-009',
    title: 'Vibration Analysis & Alignment',
    asset_id: 'SUB-009',
    asset_name: 'South Distribution Substation',
    asset_type: 'substation',
    zone: 'Zone A',
    risk_level: 'low',
    risk_score: 72,
    priority: 'routine',
    status: 'scheduled',
    date: '2026-09-29',
    start_time: '13:00',
    end_time: '16:00',
    duration_hours: 3,
    assigned_team: 'Crew Alpha',
    technician: 'B. Nwosu',
    maintenance_type: 'Preventive Maintenance',
    description: 'Vibration signature anomaly detected in bus bar section. Mechanical alignment check required.',
    action: 'Vibration analysis, mechanical alignment, torque verification',
    last_inspection: '2026-08-13',
    customers_affected: 4400,
    precautions: [
      'Check torque on all bus bar connections after alignment',
    ],
  },

  // ── Two additional tasks to reach 15 total ────────────────────────────────

  // September 10 (Thu) — HIGH
  {
    id: 'CAL-010',
    title: 'Load Balancing Review',
    asset_id: 'TRF-028',
    asset_name: 'Central Substation Transformer',
    asset_type: 'transformer',
    zone: 'Zone B',
    risk_level: 'high',
    risk_score: 70,
    priority: 'routine',
    status: 'completed',
    date: '2026-09-10',
    start_time: '08:30',
    end_time: '12:30',
    duration_hours: 4,
    assigned_team: 'Crew Delta',
    technician: 'P. Gupta',
    maintenance_type: 'Performance Review',
    description: 'Load profile exceeding balanced distribution thresholds. Tap changer calibration and load review.',
    action: 'Load profile analysis, tap changer calibration, rebalancing',
    last_inspection: '2026-08-01',
    customers_affected: 3300,
    precautions: [
      'Coordinate with load dispatch before tap changes',
    ],
  },

  // September 23 (Wed) — HIGH
  {
    id: 'CAL-011',
    title: 'Protective Relay Testing',
    asset_id: 'SUB-034',
    asset_name: 'North West Substation',
    asset_type: 'substation',
    zone: 'Zone D',
    risk_level: 'high',
    risk_score: 62,
    priority: 'routine',
    status: 'scheduled',
    date: '2026-09-23',
    start_time: '09:00',
    end_time: '14:00',
    duration_hours: 5,
    assigned_team: 'Crew Gamma',
    technician: 'C. Mendez',
    maintenance_type: 'Compliance Testing',
    description: 'Annual protective relay testing per NERC standards. Battery backup inspection included.',
    action: 'Relay timing tests, battery capacity test, firmware update',
    last_inspection: '2026-08-22',
    customers_affected: 2800,
    precautions: [
      'Notify protection coordinator before disabling relays',
      'Ensure SCADA bypass active during test window',
    ],
  },
];
