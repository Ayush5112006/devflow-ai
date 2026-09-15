# GridGuard Data Generation Pipeline

This folder contains the complete data generation pipeline for the **GridGuard — Power Outage Prediction & Grid Equipment Failure Advisor** project (IBM BOB Hackathon 2026).

It produces all 5 CSV datasets defined in [DATA_SCHEMA.md](../../DATA_SCHEMA.md). The outputs feed directly into Parth's backend (`src/backend/app/db/seed.py`) which loads them into SQLite.

---

## Quick Start

```bash
cd src/data
pip install -r requirements.txt

# Generate everything (CSVs + SQLite DB) — takes ~4 seconds
python run_all.py

# Optional: verify outputs against DATA_SCHEMA.md constraints
python verify_data.py
```

All CSVs are written to `src/data/processed/`. The merged SQLite database is written to `src/data/output/grid_data.db`.

---

## What Gets Generated

| File (CSV) | Owner | Rows (approx) | Description |
|---|---|---|---|
| `assets.csv` | Yug | ~105 | Grid topology — transformers (`TRF-###`) + substations (`SUB-###`) |
| `sensor_readings.csv` | Vedant | 75,600 | Hourly sensor data, last 30 days, per asset |
| `weather_alerts.csv` | Yug | ~150–170 | Discrete weather alert events, 2023–2026 |
| `historical_incidents.csv` | Vedant | 300 | Outage/incident records, 2023–2025 |
| `grid_zones.csv` | Yug | 5 | Zone metadata for map rendering |

---

## Pipeline Scripts

| Script | Purpose |
|---|---|
| `run_all.py` | **Master orchestrator** — runs the whole pipeline in order |
| `generate_topology.py` | Creates `assets.csv` (positions, zones, customers, critical facilities, install years) |
| `generate_sensors.py` | Creates `sensor_readings.csv` with realistic failure signatures |
| `generate_weather.py` | Creates `weather_alerts.csv` with synthetic-but-plausible weather events |
| `fetch_weather.py` | **Live mode** — fetches real 5-day forecasts from OpenWeatherMap (free API) and groups them into alert events in the same format |
| `generate_incidents.py` | Creates `historical_incidents.csv` (weighted toward older/high-load assets) |
| `generate_grid_zones.py` | Creates `grid_zones.csv` by aggregating asset data per zone |
| `merge_to_db.py` | Loads all 5 CSVs into `output/grid_data.db` and runs constraint checks |
| `verify_data.py` | Validates row counts, ID formats, tier separation, and cross-file integrity |
| `config.py` | All tuning knobs: seeds, asset counts, sensor thresholds, alert counts, paths |
| `schema.sql` | SQLite DDL for all 5 tables |

---

## File Schemas (summary — full detail in DATA_SCHEMA.md)

### `assets.csv`
`asset_id` (`TRF-###`/`SUB-###`), `asset_type` (`transformer`|`substation`), `zone`, `lat`, `lng`, `customers_served`, `has_critical_facility`, `last_inspected`, `install_year`, `voltage_kv`, `manufacturer`, `capacity_mva`

### `sensor_readings.csv`
`asset_id`, `timestamp` (ISO 8601, hourly), `temperature_c`, `vibration_mm_s`, `oil_quality_index`, `partial_discharge_mv`, `load_percent`, `ambient_temp_c`

### `weather_alerts.csv`
`alert_id` (`WX-####`), `zone`, `alert_type` (`storm`|`heatwave`|`high_wind`|`ice_storm`|`flood`), `severity` (`LOW`|`MEDIUM`|`HIGH`|`CRITICAL`), `start_time`, `end_time`, `max_wind_kmh`, `max_temp_c`, `precipitation_mm`, `source`

### `historical_incidents.csv`
`incident_id` (`INC-####`), `asset_id`, `incident_date`, `incident_type`, `severity`, `outage_duration_hrs`, `customers_affected`, `repair_cost_usd`, `weather_related`, `root_cause`

### `grid_zones.csv`
`zone`, `region_label`, `center_lat`, `center_lng`, `total_customers`, `critical_facilities`, `area_km2`

---

## Sensor Failure Signatures

Every asset is assigned to one of three hidden health tiers:

| Tier | % of assets | Signature |
|---|---|---|
| **healthy** | 60% | All sensors stay in normal range with small noise |
| **degrading** | 25% | 1–2 sensors drift toward warning range over the 30 days |
| **near_failure** | 15% | 2+ sensors in critical range with a clear worsening trend |

Near-failure assets follow the failure physics from DATA_SCHEMA.md:

- `temperature_c` starts ~70 °C and rises ~0.5 °C/day
- `vibration_mm_s` stays normal, then **spikes in the final 48–72 hours**
- `oil_quality_index` (100 = new oil) decays toward/below 30
- `partial_discharge_mv` starts ~150 mV and produces intermittent spikes after day 15

The tier assignment uses a fixed seed (`config.RANDOM_SEED = 42`) so the dataset is reproducible. These tiers are the ground truth a supervised model can learn from.

---

## Zone Distribution

```
North     25 assets
South     20 assets
East      25 assets
West      20 assets
Central   15 assets
```

`grid_zones.csv` is auto-derived from `assets.csv` (sums `customers_served` and critical facilities per zone), so it always stays consistent with the topology.

---

## Using Live Weather (optional, Yug)

`synthetic mode` is the default. If you want real forecast-driven alerts instead:

1. Get a free key at <https://openweathermap.org/api>
2. `Copy-Item src/.env.example src/.env` and set `OPENWEATHERMAP_API_KEY=...`
3. Run `python fetch_weather.py`

It fetches the free 5-day / 3-hour forecast for each zone center, classifies slots by wind/temp/precipitation thresholds, and groups consecutive severe slots into alert events in the same `weather_alerts.csv` format. The API key is never hardcoded — it is read from the environment.

---

## Handoff Checklist for Parth (backend)

- [ ] All `asset_id`s in `sensor_readings.csv` and `historical_incidents.csv` exist in `assets.csv`
- [ ] Every `zone` in `weather_alerts.csv` and `grid_zones.csv` matches `assets.csv`
- [ ] `sensor_readings.csv` timestamps are hourly and gapless (720 hours per asset)
- [ ] CSVs live in `src/data/processed/` — your `seed.py` can read this folder verbatim