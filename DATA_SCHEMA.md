# 📊 GridGuard — Data Schema & Generation Guide
### For: **Vedant** (Synthetic Sensor Data) · **Yug** (Grid Topology + Weather Data)
### Output folder: `src/data/processed/` — all files saved as CSV

---

## Overview — What Files to Produce

| File (CSV) | Owner | Description |
|---|---|---|
| `assets.csv` | **Yug** | Grid topology — one row per transformer/substation |
| `sensor_readings.csv` | **Vedant** | Time-series sensor readings per asset (30 days, hourly) |
| `historical_incidents.csv` | **Vedant** | Past failure/outage events |
| `weather_alerts.csv` | **Yug** | Weather events per zone (NOAA / OpenWeatherMap) |
| `grid_zones.csv` | **Yug** | Zone metadata (name, region, critical facilities count) |

These 5 CSVs feed directly into the SQLite database via `src/backend/app/db/seed.py`.

---

## Table 1: `assets.csv` — Owner: Yug

One row per physical grid asset (transformer or substation).

```
COLUMN NAME              TYPE        REQUIRED   EXAMPLE VALUE          NOTES
─────────────────────────────────────────────────────────────────────────────────────────
asset_id                 string      YES        TRF-042                Format: TRF-### (transformer) or SUB-### (substation)
asset_type               string      YES        transformer            Values: "transformer" | "substation"
zone                     string      YES        North                  Grid zone name (e.g. North, South, East, West, Central)
lat                      float       YES        40.7128                WGS84 latitude
lng                      float       YES        -74.0060               WGS84 longitude
customers_served         integer     YES        4200                   Number of end customers this asset serves
has_critical_facility    integer     YES        1                      1 = hospital/fire station/data center nearby; 0 = no
last_inspected           date        YES        2025-11-20             ISO date YYYY-MM-DD of last physical inspection
install_year             integer     YES        2008                   Year the asset was installed (affects age-based risk)
voltage_kv               float       NO         138.0                  Operating voltage in kilovolts
manufacturer             string      NO         ABB                    Asset manufacturer name
capacity_mva             float       NO         250.0                  Rated capacity in MVA
─────────────────────────────────────────────────────────────────────────────────────────
```

**Target row count:** ~100–150 assets total (mix of ~70% transformers, ~30% substations)

**Zone distribution (suggested):**

```
Zone        Asset Count    Notes
──────────────────────────────────────────────────────
North       25             Mix urban/suburban
South       20             More industrial
East        25             Dense residential
West        20             Mix + some rural
Central     15             CBD — highest customers_served
──────────────────────────────────────────────────────
```

---

## Table 2: `sensor_readings.csv` — Owner: Vedant

Time-series sensor data. One row per asset per hour for the **last 30 days**.
With 120 assets × 30 days × 24 hours = **~86,400 rows minimum**.

```
COLUMN NAME              TYPE        REQUIRED   EXAMPLE VALUE          NOTES
─────────────────────────────────────────────────────────────────────────────────────────
asset_id                 string      YES        TRF-042                Must match an asset_id in assets.csv
timestamp                datetime    YES        2026-05-16T14:00:00    ISO 8601 UTC — hourly intervals
temperature_c            float       YES        72.4                   Oil/winding temperature in °C. Normal: 40–75. Alert: >85
vibration_mm_s           float       YES        3.2                    Vibration in mm/s. Normal: 0–5. Alert: >7.5
oil_quality_index        float       YES        65.0                   0–100 scale (100=new oil). Alert: <30
partial_discharge_mv     float       YES        120.5                  Partial discharge in mV. Normal: 0–200. Alert: >500
load_percent             float       NO         78.2                   % of rated capacity currently in use (0–120)
ambient_temp_c           float       NO         28.0                   Ambient outside temperature at asset location
─────────────────────────────────────────────────────────────────────────────────────────
```

### Sensor Normal Ranges & Failure Signatures (for synthetic generation)

```
SENSOR                  NORMAL RANGE      WARNING RANGE     CRITICAL RANGE    FAILURE SIGNATURE
──────────────────────────────────────────────────────────────────────────────────────────────────────
temperature_c           40 – 75 °C        75 – 85 °C        > 85 °C           Gradual rise over 2–3 weeks before failure
vibration_mm_s          0 – 5 mm/s        5 – 7.5 mm/s      > 7.5 mm/s        Sudden spike 48–72 hrs before failure
oil_quality_index       60 – 100          30 – 60           < 30              Slow degradation over months
partial_discharge_mv    0 – 200 mV        200 – 500 mV      > 500 mV          Intermittent spikes weeks before failure
──────────────────────────────────────────────────────────────────────────────────────────────────────
```

### How to Generate Realistic Failure Signatures (Vedant)

Generate 3 asset categories:

```
CATEGORY         % OF ASSETS    SENSOR BEHAVIOR
──────────────────────────────────────────────────────────────────────────────
healthy          60%            All sensors in normal range with small noise
degrading        25%            1–2 sensors drifting toward warning range
near_failure     15%            2+ sensors in critical range; clear trend upward
──────────────────────────────────────────────────────────────────────────────
```

For `near_failure` assets: embed a realistic trend — e.g., `temperature_c` starts at 70°C at day 1 and rises ~0.5°C/day, `partial_discharge_mv` starts at 150 mV and spikes intermittently after day 15.

---

## Table 3: `historical_incidents.csv` — Owner: Vedant

Past outage/failure events. One row per incident.

```
COLUMN NAME              TYPE        REQUIRED   EXAMPLE VALUE          NOTES
─────────────────────────────────────────────────────────────────────────────────────────
incident_id              string      YES        INC-0001               Unique incident ID
asset_id                 string      YES        TRF-042                Must match assets.csv
incident_date            date        YES        2024-03-12             ISO date YYYY-MM-DD
incident_type            string      YES        transformer_failure    Values: "transformer_failure" | "overload" | "partial_discharge_fault" | "oil_leak" | "overheating"
severity                 string      YES        HIGH                   Values: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
outage_duration_hrs      float       YES        6.5                    Hours of outage caused
customers_affected       integer     YES        3800                   Customers without power
repair_cost_usd          float       NO         45000.00               Estimated repair cost
weather_related          integer     NO         1                      1 = weather contributed; 0 = no
root_cause               string      NO         overheating            Free text — root cause from post-mortem
─────────────────────────────────────────────────────────────────────────────────────────
```

**Target row count:** ~200–400 incidents over a 3-year lookback (2023–2025)

---

## Table 4: `weather_alerts.csv` — Owner: Yug

Active and historical weather events mapped to grid zones.

```
COLUMN NAME              TYPE        REQUIRED   EXAMPLE VALUE          NOTES
─────────────────────────────────────────────────────────────────────────────────────────
alert_id                 string      YES        WX-0001                Unique alert ID
zone                     string      YES        North                  Must match zone values in assets.csv
alert_type               string      YES        storm                  Values: "storm" | "heatwave" | "high_wind" | "ice_storm" | "flood"
severity                 string      YES        HIGH                   Values: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
start_time               datetime    YES        2026-06-14T18:00:00    ISO 8601 UTC
end_time                 datetime    YES        2026-06-15T06:00:00    ISO 8601 UTC (can be NULL if ongoing)
max_wind_kmh             float       NO         95.0                   Maximum wind speed in km/h
max_temp_c               float       NO         42.0                   Peak temperature during heatwave
precipitation_mm         float       NO         88.0                   Rainfall in mm during storm
source                   string      NO         NOAA                   Data source: "NOAA" | "OpenWeatherMap" | "synthetic"
─────────────────────────────────────────────────────────────────────────────────────────
```

**How to get real data (Yug):**
- NOAA Storm Events Database: https://www.ncdc.noaa.gov/stormevents/
- OpenWeatherMap historical: `GET https://history.openweathermap.org/data/2.5/history/city`
- If API unavailable → generate synthetic alerts: ~2–3 events per zone per month

---

## Table 5: `grid_zones.csv` — Owner: Yug

One row per zone — metadata for map rendering and risk context.

```
COLUMN NAME              TYPE        REQUIRED   EXAMPLE VALUE          NOTES
─────────────────────────────────────────────────────────────────────────────────────────
zone                     string      YES        North                  Must match zone values in assets.csv
region_label             string      YES        Northern Grid          Display name for UI
center_lat               float       YES        40.8000                Approx. center latitude of zone
center_lng               float       YES        -74.1000               Approx. center longitude of zone
total_customers          integer     YES        125000                 Total customers in this zone
critical_facilities      integer     YES        4                      Hospitals, fire stations, data centers in zone
area_km2                 float       NO         320.5                  Zone area in km²
─────────────────────────────────────────────────────────────────────────────────────────
```

---

## Final Checklist Before Handing Off to Backend (Parth)

```
FILE                       ROWS (approx)    KEY CONSTRAINT
──────────────────────────────────────────────────────────────────────────────
assets.csv                 100–150          asset_id must be unique; lat/lng must be real coordinates
sensor_readings.csv        86,000+          asset_id must exist in assets.csv; timestamp = hourly, no gaps
historical_incidents.csv   200–400          asset_id must exist in assets.csv
weather_alerts.csv         100–200          zone must match assets.csv zone values
grid_zones.csv             5                zone values must match ALL zone values used in assets.csv
──────────────────────────────────────────────────────────────────────────────
```

### Cross-file consistency rules (IMPORTANT)

1. Every `asset_id` in `sensor_readings.csv` and `historical_incidents.csv` **must exist** in `assets.csv`
2. Every `zone` in `weather_alerts.csv` and `grid_zones.csv` **must match exactly** the zone values in `assets.csv`
3. `sensor_readings.csv` timestamps must be **hourly, no missing hours** for the last 30 days per asset
4. `historical_incidents.csv` dates should cover **2023-01-01 to 2025-12-31**
5. `weather_alerts.csv` should include both **past events** (2023–2025) and **current/upcoming** (2026)

---

## Output Folder

All files go to:
```
src/data/processed/
    assets.csv
    sensor_readings.csv
    historical_incidents.csv
    weather_alerts.csv
    grid_zones.csv
```

Parth's `seed.py` will read from this exact folder path.

---

*Generated for Telemetry Titans — IBM Hackathon 2026*
