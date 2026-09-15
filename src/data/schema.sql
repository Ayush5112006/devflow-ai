-- ========================================================
-- Telemetry Titans -- Grid Outage Prediction Data Schema
-- ========================================================

-- 1. Asset master table
CREATE TABLE IF NOT EXISTS assets (
    asset_id            TEXT PRIMARY KEY,
    asset_type          TEXT NOT NULL,
    zone                TEXT NOT NULL,
    lat                 REAL NOT NULL,
    lng                 REAL NOT NULL,
    customers_served    INTEGER NOT NULL,
    has_critical_facility INTEGER NOT NULL DEFAULT 0,
    last_inspected      TEXT NOT NULL,
    install_year        INTEGER NOT NULL,
    voltage_kv          REAL,
    manufacturer        TEXT,
    capacity_mva        REAL
);

-- 2. Sensor readings (hourly, 30 days)
CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id            TEXT NOT NULL REFERENCES assets(asset_id),
    timestamp           TEXT NOT NULL,
    temperature_c       REAL NOT NULL,
    vibration_mm_s      REAL NOT NULL,
    oil_quality_index   REAL NOT NULL,
    partial_discharge_mv REAL NOT NULL,
    load_percent        REAL,
    ambient_temp_c      REAL
);

CREATE INDEX IF NOT EXISTS idx_sensor_asset_ts
    ON sensor_readings(asset_id, timestamp);

-- 3. Weather alerts (discrete events)
CREATE TABLE IF NOT EXISTS weather_alerts (
    alert_id            TEXT PRIMARY KEY,
    zone                TEXT NOT NULL,
    alert_type          TEXT NOT NULL,
    severity            TEXT NOT NULL,
    start_time          TEXT NOT NULL,
    end_time            TEXT,
    max_wind_kmh        REAL,
    max_temp_c          REAL,
    precipitation_mm    REAL,
    source              TEXT
);

CREATE INDEX IF NOT EXISTS idx_weather_zone
    ON weather_alerts(zone);

-- 4. Historical incident / outage records
CREATE TABLE IF NOT EXISTS historical_incidents (
    incident_id         TEXT PRIMARY KEY,
    asset_id            TEXT NOT NULL REFERENCES assets(asset_id),
    incident_date       TEXT NOT NULL,
    incident_type       TEXT NOT NULL,
    severity            TEXT NOT NULL,
    outage_duration_hrs REAL NOT NULL,
    customers_affected  INTEGER NOT NULL,
    repair_cost_usd     REAL,
    weather_related     INTEGER DEFAULT 0,
    root_cause          TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_asset
    ON historical_incidents(asset_id);

-- 5. Grid zone metadata
CREATE TABLE IF NOT EXISTS grid_zones (
    zone                TEXT PRIMARY KEY,
    region_label        TEXT NOT NULL,
    center_lat          REAL NOT NULL,
    center_lng          REAL NOT NULL,
    total_customers     INTEGER NOT NULL,
    critical_facilities INTEGER NOT NULL,
    area_km2            REAL
);
