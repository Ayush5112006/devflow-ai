"""
generate_grid_zones.py
──────────────────────
Creates grid_zones.csv matching DATA_SCHEMA.md:
  One row per zone with metadata for map rendering.

Columns: zone, region_label, center_lat, center_lng,
         total_customers, critical_facilities, area_km2
"""

import numpy as np
import pandas as pd

from config import (
    ZONES, ZONE_CENTERS, ZONE_AREA_KM2, RANDOM_SEED,
)


def generate_grid_zones(
    assets_df: pd.DataFrame,
    seed: int = RANDOM_SEED,
) -> pd.DataFrame:
    region_labels = {
        "North":   "Northern Grid",
        "South":   "Southern Grid",
        "East":    "Eastern Grid",
        "West":    "Western Grid",
        "Central": "Central Grid",
    }

    rows = []
    for zone in ZONES:
        zone_assets = assets_df[assets_df["zone"] == zone]
        total_customers = int(zone_assets["customers_served"].sum())
        critical_facilities = int(zone_assets["has_critical_facility"].sum())
        center = ZONE_CENTERS[zone]

        rows.append({
            "zone": zone,
            "region_label": region_labels[zone],
            "center_lat": center["lat"],
            "center_lng": center["lng"],
            "total_customers": total_customers,
            "critical_facilities": critical_facilities,
            "area_km2": ZONE_AREA_KM2[zone],
        })

    df = pd.DataFrame(rows)
    print(f"[grid_zones] Generated {len(df)} zone records")
    print(f"  Total customers across all zones: {df['total_customers'].sum():,}")
    return df


if __name__ == "__main__":
    from generate_topology import generate_assets
    assets = generate_assets()
    df = generate_grid_zones(assets)
    df.to_csv("processed/grid_zones.csv", index=False)
    print("Saved to processed/grid_zones.csv")
