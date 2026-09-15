"""
generate_topology.py
────────────────────
Creates assets.csv matching DATA_SCHEMA.md:
  - TRF-### (transformers) / SUB-### (substations)
  - ~105 assets across 5 zones with exact zone counts
  - Columns: asset_id, asset_type, zone, lat, lng, customers_served,
    has_critical_facility, last_inspected, install_year,
    voltage_kv, manufacturer, capacity_mva
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from config import (
    CENTER_LAT, CENTER_LON, SPREAD_LAT, SPREAD_LON,
    ZONES, ZONE_ASSET_COUNTS, ZONE_CENTERS,
    VOLTAGE_TIERS, CAPACITY_RANGES, MANUFACTURERS,
    TRANSFORMER_FRACTION, RANDOM_SEED,
)


def generate_assets(seed: int = RANDOM_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    now = datetime(2026, 9, 15)
    rows = []
    trf_counter = 0
    sub_counter = 0

    for zone in ZONES:
        n_assets = ZONE_ASSET_COUNTS[zone]
        center = ZONE_CENTERS[zone]
        n_transformers = int(n_assets * TRANSFORMER_FRACTION)
        n_substations = n_assets - n_transformers

        # Generate transformers
        for _ in range(n_transformers):
            trf_counter += 1
            asset_id = f"TRF-{trf_counter:03d}"
            lat = center["lat"] + rng.normal(0, SPREAD_LAT / 6)
            lng = center["lng"] + rng.normal(0, SPREAD_LON / 6)
            voltage = float(rng.choice(VOLTAGE_TIERS["transformer"]))
            cap_lo, cap_hi = CAPACITY_RANGES["transformer"]
            capacity = round(float(rng.uniform(cap_lo, cap_hi)), 1)
            install_year = int(rng.integers(1990, 2025))
            last_inspected = (now - timedelta(days=int(rng.integers(5, 330)))).strftime("%Y-%m-%d")
            has_critical = int(rng.random() < 0.35)
            customers = int(rng.integers(200, 15000))
            manufacturer = rng.choice(MANUFACTURERS)

            rows.append({
                "asset_id": asset_id,
                "asset_type": "transformer",
                "zone": zone,
                "lat": round(float(lat), 6),
                "lng": round(float(lng), 6),
                "customers_served": customers,
                "has_critical_facility": has_critical,
                "last_inspected": last_inspected,
                "install_year": install_year,
                "voltage_kv": voltage,
                "manufacturer": manufacturer,
                "capacity_mva": capacity,
            })

        # Generate substations
        for _ in range(n_substations):
            sub_counter += 1
            asset_id = f"SUB-{sub_counter:03d}"
            lat = center["lat"] + rng.normal(0, SPREAD_LAT / 5)
            lng = center["lng"] + rng.normal(0, SPREAD_LON / 5)
            voltage = float(rng.choice(VOLTAGE_TIERS["substation"]))
            cap_lo, cap_hi = CAPACITY_RANGES["substation"]
            capacity = round(float(rng.uniform(cap_lo, cap_hi)), 1)
            install_year = int(rng.integers(1985, 2020))
            last_inspected = (now - timedelta(days=int(rng.integers(10, 280)))).strftime("%Y-%m-%d")
            has_critical = int(rng.random() < 0.50)
            customers = int(rng.integers(5000, 50000))
            manufacturer = rng.choice(MANUFACTURERS)

            rows.append({
                "asset_id": asset_id,
                "asset_type": "substation",
                "zone": zone,
                "lat": round(float(lat), 6),
                "lng": round(float(lng), 6),
                "customers_served": customers,
                "has_critical_facility": has_critical,
                "last_inspected": last_inspected,
                "install_year": install_year,
                "voltage_kv": voltage,
                "manufacturer": manufacturer,
                "capacity_mva": capacity,
            })

    df = pd.DataFrame(rows)
    print(f"[topology] Generated {len(df)} assets")
    print(f"  Types: {df['asset_type'].value_counts().to_dict()}")
    print(f"  Zones: {df['zone'].value_counts().to_dict()}")
    return df


if __name__ == "__main__":
    df = generate_assets()
    df.to_csv("processed/assets.csv", index=False)
    print("Saved to processed/assets.csv")
