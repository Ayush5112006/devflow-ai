"""
generate_weather.py
───────────────────
Creates weather_alerts.csv matching DATA_SCHEMA.md:
  Discrete weather alert events (not continuous readings).

Columns: alert_id (WX-####), zone, alert_type, severity, start_time, end_time,
         max_wind_kmh, max_temp_c, precipitation_mm, source

Target: ~100-200 alerts across 2023-2026.
  - 2023-2025: past events (2-3 per zone per month on average)
  - 2026: current/upcoming events (several storm windows to drive predictions)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from config import (
    ZONES, ALERT_TYPES, ALERT_SEVERITY, ALERT_SOURCES,
    TARGET_ALERTS, RANDOM_SEED,
)


# Base severity weights per alert type
TYPE_SEVERITY_WEIGHTS = {
    "storm":     {"CRITICAL": 0.15, "HIGH": 0.30, "MEDIUM": 0.35, "LOW": 0.20},
    "heatwave":  {"CRITICAL": 0.10, "HIGH": 0.25, "MEDIUM": 0.40, "LOW": 0.25},
    "high_wind": {"CRITICAL": 0.10, "HIGH": 0.25, "MEDIUM": 0.35, "LOW": 0.30},
    "ice_storm": {"CRITICAL": 0.30, "HIGH": 0.35, "MEDIUM": 0.25, "LOW": 0.10},
    "flood":     {"CRITICAL": 0.20, "HIGH": 0.30, "MEDIUM": 0.30, "LOW": 0.20},
}

# Duration ranges (hours) by severity
SEVERITY_DURATION_HRS = {
    "CRITICAL": (12, 48),
    "HIGH":     (6, 24),
    "MEDIUM":   (2, 12),
    "LOW":      (1, 6),
}


def generate_weather_alerts(seed: int = RANDOM_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # Time range: 2023-01-01 to 2026-09-15
    start = datetime(2023, 1, 1)
    end = datetime(2026, 9, 15)
    total_days = (end - start).days

    # Target: alerts per zone per month ~2
    n_alerts = TARGET_ALERTS
    n_per_zone = n_alerts // len(ZONES)
    # Distribute with slight randomness
    zone_counts = {}
    remaining = n_alerts
    for zone in ZONES[:-1]:
        c = n_per_zone + rng.integers(-2, 3)
        c = max(10, min(c, remaining - (len(ZONES) - len(zone_counts) - 1) * 8))
        zone_counts[zone] = c
        remaining -= c
    zone_counts[ZONES[-1]] = remaining

    rows = []
    alert_counter = 0

    for zone, count in zone_counts.items():
        for _ in range(count):
            alert_counter += 1
            alert_id = f"WX-{alert_counter:04d}"

            # Random date within range
            day_offset = rng.uniform(0, total_days)
            alert_start = start + timedelta(days=day_offset, hours=int(rng.integers(0, 24)))

            # Pick alert type (storm most common, ice_storm rare)
            alert_type = rng.choice(
                ALERT_TYPES, p=[0.30, 0.20, 0.25, 0.10, 0.15]
            )

            # Pick severity for this type
            sev_weights = TYPE_SEVERITY_WEIGHTS[alert_type]
            severity = rng.choice(
                ALERT_SEVERITY,
                p=[sev_weights[s] for s in ALERT_SEVERITY],
            )

            # Duration
            dur_lo, dur_hi = SEVERITY_DURATION_HRS[severity]
            duration_hrs = round(rng.uniform(dur_lo, dur_hi), 1)
            alert_end = alert_start + timedelta(hours=duration_hrs)

            # Metric fields — null by default, filled based on type
            max_wind = None
            max_temp = None
            precip = None

            if alert_type in ("storm", "high_wind", "ice_storm"):
                max_wind = round(float(rng.uniform(40, 130)), 1)
                precip = round(float(rng.uniform(5, 95)), 1)
            elif alert_type == "heatwave":
                max_temp = round(float(rng.uniform(38, 48)), 1)
            elif alert_type == "flood":
                precip = round(float(rng.uniform(50, 200)), 1)

            source = rng.choice(ALERT_SOURCES)

            rows.append({
                "alert_id": alert_id,
                "zone": zone,
                "alert_type": alert_type,
                "severity": severity,
                "start_time": alert_start.strftime("%Y-%m-%dT%H:%M:%S"),
                "end_time": alert_end.strftime("%Y-%m-%dT%H:%M:%S"),
                "max_wind_kmh": max_wind,
                "max_temp_c": max_temp,
                "precipitation_mm": precip,
                "source": source,
            })

    df = pd.DataFrame(rows)

    # Add several high-severity storm events in 2026 for the prediction window
    critical_storms = [
        ("2026-06-10T02:00:00", 18, 95,  45, "storm"),
        ("2026-07-22T14:00:00", 8,  60,  25, "high_wind"),
        ("2026-08-30T20:00:00", 12, 110, 55, "storm"),
        ("2026-09-12T06:00:00", 6,  50,  20, "storm"),
    ]
    for start_str, dur_hrs, wind, prec, atype in critical_storms:
        alert_counter += 1
        s = datetime.strptime(start_str, "%Y-%m-%dT%H:%M:%S")
        e = s + timedelta(hours=dur_hrs)
        for zone in ZONES:
            alert_counter += 1
            rows.append({
                "alert_id": f"WX-{alert_counter:04d}",
                "zone": zone,
                "alert_type": atype,
                "severity": "HIGH",
                "start_time": start_str,
                "end_time": e.strftime("%Y-%m-%dT%H:%M:%S"),
                "max_wind_kmh": wind + rng.uniform(-10, 10),
                "max_temp_c": None,
                "precipitation_mm": prec + rng.uniform(-5, 5),
                "source": "synthetic",
            })

    df = pd.DataFrame(rows)
    print(f"[weather] Generated {len(df)} weather alerts")
    print(f"  By type: {df['alert_type'].value_counts().to_dict()}")
    print(f"  By severity: {df['severity'].value_counts().to_dict()}")
    print(f"  Zones: {df['zone'].value_counts().to_dict()}")
    return df


if __name__ == "__main__":
    df = generate_weather_alerts()
    df.to_csv("processed/weather_alerts.csv", index=False)
    print("Saved to processed/weather_alerts.csv")
