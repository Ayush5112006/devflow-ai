"""
generate_sensors.py
───────────────────
Creates sensor_readings.csv matching DATA_SCHEMA.md:
  - 30 days, hourly intervals, ~86,400+ rows
  - Columns: asset_id, timestamp, temperature_c, vibration_mm_s,
    oil_quality_index, partial_discharge_mv, load_percent, ambient_temp_c

Failure signatures per DATA_SCHEMA.md:
  temperature_c:      gradual rise 0.5 C/day over weeks before failure
  vibration_mm_s:     sudden spike 48-72 hrs before failure
  oil_quality_index:  slow degradation over months (starts high, drops)
  partial_discharge_mv: intermittent spikes weeks before failure

Asset categories:
  healthy (60%):      all sensors in normal range, small noise
  degrading (25%):    1-2 sensors drifting toward warning range
  near_failure (15%): 2+ sensors in critical range with clear trend
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from config import (
    SENSOR_HISTORY_DAYS, SENSOR_INTERVAL_HOURS,
    SENSOR_NORMAL, SENSOR_CRITICAL,
    FRACTION_HEALTHY, FRACTION_DEGRADING, FRACTION_NEAR_FAILURE,
    RANDOM_SEED,
)


def _generate_sensor_trace(
    rng: np.random.Generator,
    n_steps: int,
    tier: str,
    load_base: float,
) -> dict:
    """Generate sensor readings for one asset over 30 days."""
    traces = {
        "temperature_c": np.zeros(n_steps),
        "vibration_mm_s": np.zeros(n_steps),
        "oil_quality_index": np.zeros(n_steps),
        "partial_discharge_mv": np.zeros(n_steps),
        "load_percent": np.zeros(n_steps),
        "ambient_temp_c": np.zeros(n_steps),
    }

    hours = np.arange(n_steps)

    # Ambient temperature: normal distribution around 28-32C with diurnal cycle
    traces["ambient_temp_c"] = 30 + 4 * np.sin((hours - 5) * np.pi / 12) + rng.normal(0, 1.5, n_steps)

    # Base load: daily pattern
    traces["load_percent"] = np.clip(
        load_base + 12 * np.sin((hours - 6) * np.pi / 12) + rng.normal(0, 4, n_steps),
        5, 120,
    )

    if tier == "healthy":
        # All in normal range with small noise
        traces["temperature_c"] = np.clip(
            55 + 8 * np.sin((hours - 5) * np.pi / 12) + rng.normal(0, 2.5, n_steps),
            *SENSOR_NORMAL["temperature_c"],
        )
        traces["vibration_mm_s"] = np.clip(
            rng.normal(1.5, 0.6, n_steps), 0, 5,
        )
        traces["oil_quality_index"] = np.clip(
            rng.normal(82, 5, n_steps), 60, 100,
        )
        traces["partial_discharge_mv"] = np.clip(
            rng.normal(80, 30, n_steps), 0, 200,
        )

    elif tier == "degrading":
        # 1-2 sensors drift toward warning range over 30 days
        t = np.linspace(0, 1, n_steps)

        # Temperature drifts up
        traces["temperature_c"] = np.clip(
            60 + t * 20 + rng.normal(0, 2.5, n_steps),
            40, 85,
        )
        # Vibration stays mostly normal with slight uptrend
        traces["vibration_mm_s"] = np.clip(
            1.5 + t * 3.0 + rng.normal(0, 0.4, n_steps), 0, 7.5,
        )
        # Oil quality degrades (drops)
        traces["oil_quality_index"] = np.clip(
            80 - t * 35 + rng.normal(0, 4, n_steps), 30, 100,
        )
        # PD moderate
        traces["partial_discharge_mv"] = np.clip(
            100 + t * 200 + rng.normal(0, 25, n_steps), 0, 500,
        )

    elif tier == "near_failure":
        # 2+ sensors in critical range; clear worsening trend
        t = np.linspace(0, 1, n_steps)

        # Temperature: starts at ~70C, rises ~0.5C/day = 15C over 30 days
        traces["temperature_c"] = np.clip(
            70 + t * 20 + rng.normal(0, 1.5, n_steps),
            40, 100,
        )

        # Vibration: normal for 27 days, sudden spike in last 72 hrs (last 3 steps)
        base_vib = rng.normal(2.0, 0.3, n_steps)
        spike_start = n_steps - 3
        base_vib[spike_start:] = np.clip(
            7.5 + rng.uniform(0, 3, n_steps - spike_start), 7.5, 15,
        )
        traces["vibration_mm_s"] = base_vib

        # Oil quality: slow degradation from 60 toward 20
        traces["oil_quality_index"] = np.clip(
            60 - t * 40 + rng.normal(0, 3, n_steps), 10, 100,
        )

        # Partial discharge: starts at ~150 mV, intermittent spikes after day 15
        pd_base = 150 + t * 400 + rng.normal(0, 20, n_steps)
        # Add intermittent spikes after day 15 (step ~ 504 for hourly 30-day)
        spike_step = int(n_steps * 0.5)
        spike_mask = rng.random(n_steps) < 0.03  # 3% chance of spike per hour
        spike_mask[:spike_step] = False
        pd_base[spike_mask] += rng.exponential(200, spike_mask.sum())
        traces["partial_discharge_mv"] = np.clip(pd_base, 0, 1500)

    return traces


def generate_sensors(
    assets_df: pd.DataFrame,
    seed: int = RANDOM_SEED,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    n_assets = len(assets_df)
    n_steps = SENSOR_HISTORY_DAYS * 24
    end_date = datetime(2026, 9, 15, 0, 0, 0)
    start_date = end_date - timedelta(days=SENSOR_HISTORY_DAYS)
    timestamps = pd.date_range(
        start_date, end_date, freq=f"{SENSOR_INTERVAL_HOURS}h", inclusive="left"
    )[:n_steps]

    # Classify assets into tiers
    n_near = int(n_assets * FRACTION_NEAR_FAILURE)
    n_deg  = int(n_assets * FRACTION_DEGRADING)
    indices = rng.choice(n_assets, n_assets, replace=False)
    near_idx = set(indices[:n_near])
    deg_idx  = set(indices[n_near:n_near + n_deg])
    healthy_idx = set(indices[n_near + n_deg:])

    rows = []
    for asset_idx, asset in assets_df.iterrows():
        a_id = asset["asset_id"]

        if asset_idx in near_idx:
            tier = "near_failure"
            load_base = rng.uniform(55, 80)
        elif asset_idx in deg_idx:
            tier = "degrading"
            load_base = rng.uniform(40, 70)
        else:
            tier = "healthy"
            load_base = rng.uniform(30, 60)

        traces = _generate_sensor_trace(rng, n_steps, tier, load_base)

        for ts_idx, ts in enumerate(timestamps):
            rows.append({
                "asset_id": a_id,
                "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
                "temperature_c": round(float(traces["temperature_c"][ts_idx]), 1),
                "vibration_mm_s": round(float(traces["vibration_mm_s"][ts_idx]), 2),
                "oil_quality_index": round(float(traces["oil_quality_index"][ts_idx]), 1),
                "partial_discharge_mv": round(float(traces["partial_discharge_mv"][ts_idx]), 1),
                "load_percent": round(float(traces["load_percent"][ts_idx]), 1),
                "ambient_temp_c": round(float(traces["ambient_temp_c"][ts_idx]), 1),
            })

    df = pd.DataFrame(rows)
    print(f"[sensors] Generated {len(df)} sensor readings for {n_assets} assets")
    print(f"  near_failure: {len(near_idx)} assets")
    print(f"  degrading: {len(deg_idx)} assets")
    print(f"  healthy: {len(healthy_idx)} assets")
    return df


if __name__ == "__main__":
    dummy = pd.DataFrame([{"asset_id": "TRF-001"}, {"asset_id": "SUB-001"}])
    df = generate_sensors(dummy)
    print(df.head(10))
