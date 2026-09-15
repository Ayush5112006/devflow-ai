"""
Shared configuration for the Telemetry Titans data generation pipeline.
Matches DATA_SCHEMA.md specification exactly.
"""

import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR = Path(__file__).parent
OUTPUT_DIR = DATA_DIR / "processed"
OUTPUT_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "output" / "grid_data.db"
DATA_DIR.joinpath("output").mkdir(exist_ok=True)

# ── Reproducibility ────────────────────────────────────────────────────────────
RANDOM_SEED = 42

# ── Geography ──────────────────────────────────────────────────────────────────
CENTER_LAT = 28.6139
CENTER_LON = 77.2090
SPREAD_LAT = 0.25
SPREAD_LON = 0.30

# ── Zone distribution (from DATA_SCHEMA.md) ───────────────────────────────────
ZONES = ["North", "South", "East", "West", "Central"]
ZONE_ASSET_COUNTS = {"North": 25, "South": 20, "East": 25, "West": 20, "Central": 15}
ZONE_CENTERS = {
    "North":  {"lat": 28.70, "lng": 77.18},
    "South":  {"lat": 28.53, "lng": 77.22},
    "East":   {"lat": 28.62, "lng": 77.30},
    "West":   {"lat": 28.62, "lng": 77.10},
    "Central":{"lat": 28.63, "lng": 77.23},
}
ZONE_AREA_KM2 = {"North": 320.5, "South": 280.0, "East": 295.0, "West": 310.0, "Central": 185.0}

# ── Asset types (only 2) ─────────────────────────────────────────────────────
ASSET_TYPES = ["transformer", "substation"]
TRANSFORMER_FRACTION = 0.70

# Voltage tiers per type (kV)
VOLTAGE_TIERS = {
    "transformer": [11, 33, 66, 132, 220],
    "substation":  [66, 132, 220, 400],
}
CAPACITY_RANGES = {
    "transformer": (0.5, 300),
    "substation":  (50, 500),
}
MANUFACTURERS = [
    "ABB", "Siemens", "GE Grid", "Schneider Electric",
    "Toshiba", "BHEL", "Crompton Greaves", "Hitachi Energy",
]
SUBSTATION_NAMES = [
    "Alpha", "Bravo", "Charlie", "Delta", "Echo",
    "Foxtrot", "Golf", "Hotel", "India", "Juliet",
    "Kilo", "Lima", "Mike", "November", "Oscar",
]

# ── Sensor window (30 days, hourly) ──────────────────────────────────────────
SENSOR_HISTORY_DAYS = 30
SENSOR_INTERVAL_HOURS = 1

# Sensor normal ranges & failure thresholds (from DATA_SCHEMA.md)
SENSOR_NORMAL = {
    "temperature_c":       (40, 75),
    "vibration_mm_s":      (0, 5),
    "oil_quality_index":   (60, 100),
    "partial_discharge_mv":(0, 200),
}
SENSOR_WARNING = {
    "temperature_c":       (75, 85),
    "vibration_mm_s":      (5, 7.5),
    "oil_quality_index":   (30, 60),
    "partial_discharge_mv":(200, 500),
}
SENSOR_CRITICAL = {
    "temperature_c":       85,
    "vibration_mm_s":      7.5,
    "oil_quality_index":   30,
    "partial_discharge_mv":500,
}

# ── Failure simulation ────────────────────────────────────────────────────────
FRACTION_HEALTHY     = 0.60
FRACTION_DEGRADING   = 0.25
FRACTION_NEAR_FAILURE= 0.15

# ── Historical incidents ───────────────────────────────────────────────────────
INCIDENT_START = "2023-01-01"
INCIDENT_END   = "2025-12-31"
TARGET_INCIDENTS = 300

INCIDENT_TYPES = [
    "transformer_failure",
    "overload",
    "partial_discharge_fault",
    "oil_leak",
    "overheating",
]
SEVERITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
CAUSES = [
    "Insulation degradation",
    "Overloaded transformer",
    "Lightning strike",
    "Tree contact with overhead line",
    "Manufacturing defect",
    "Moisture ingress",
    "Aging equipment",
    "Loose connection overheating",
    "Oil contamination",
    "Corrosion of contacts",
    "External vehicle impact",
    "Flooding of underground vault",
    "Switching surge",
]

# ── Weather alerts ────────────────────────────────────────────────────────────
ALERT_TYPES = ["storm", "heatwave", "high_wind", "ice_storm", "flood"]
ALERT_SEVERITY = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
ALERT_SOURCES = ["NOAA", "OpenWeatherMap", "synthetic"]
TARGET_ALERTS = 150
