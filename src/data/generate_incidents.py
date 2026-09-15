"""
generate_incidents.py
─────────────────────
Creates historical_incidents.csv matching DATA_SCHEMA.md:
  ~300 incidents over 2023-01-01 to 2025-12-31.

Columns: incident_id (INC-####), asset_id, incident_date, incident_type,
         severity (UPPERCASE), outage_duration_hrs, customers_affected,
         repair_cost_usd, weather_related, root_cause
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from config import (
    INCIDENT_START, INCIDENT_END, TARGET_INCIDENTS,
    INCIDENT_TYPES, SEVERITY_LEVELS, CAUSES,
    RANDOM_SEED,
)


def generate_incidents(
    assets_df: pd.DataFrame,
    seed: int = RANDOM_SEED,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    start = datetime.strptime(INCIDENT_START, "%Y-%m-%d")
    end = datetime.strptime(INCIDENT_END, "%Y-%m-%d")
    total_days = (end - start).days

    # Weight assets: transformers fail more, older assets fail more
    age_years = 2026 - assets_df["install_year"].values
    type_weights = assets_df["asset_type"].map({
        "transformer": 3.0,
        "substation": 1.5,
    }).fillna(1).values
    weights = type_weights * (1 + age_years / 30)
    weights = weights / weights.sum()

    rows = []
    for inc_idx in range(TARGET_INCIDENTS):
        asset_idx = rng.choice(len(assets_df), p=weights)
        asset = assets_df.iloc[asset_idx]

        # Random date within range
        day_offset = rng.uniform(0, total_days)
        inc_date = start + timedelta(days=day_offset)

        # Incident type
        incident_type = rng.choice(
            INCIDENT_TYPES, p=[0.25, 0.25, 0.20, 0.15, 0.15]
        )

        # Severity
        severity = rng.choice(
            SEVERITY_LEVELS, p=[0.10, 0.30, 0.40, 0.20]
        )

        # Customers affected
        cust_mult = {"CRITICAL": 0.8, "HIGH": 0.5, "MEDIUM": 0.25, "LOW": 0.08}
        customers = int(np.clip(
            asset["customers_served"] * cust_mult[severity] * rng.uniform(0.4, 1.2),
            10, asset["customers_served"],
        ))

        # Outage duration (hours)
        base_dur = {"CRITICAL": 18, "HIGH": 8, "MEDIUM": 3, "LOW": 0.5}
        duration = round(max(0.25, rng.exponential(base_dur[severity]) + rng.uniform(0, 2)), 1)

        # Repair cost
        base_cost = {"CRITICAL": 80000, "HIGH": 35000, "MEDIUM": 12000, "LOW": 3000}
        repair_cost = round(base_cost[severity] * rng.uniform(0.5, 2.0), 2)

        # Weather related
        weather_related = 1 if rng.random() < 0.20 else 0

        # Root cause
        root_cause = rng.choice(CAUSES)

        rows.append({
            "incident_id": f"INC-{inc_idx + 1:04d}",
            "asset_id": asset["asset_id"],
            "incident_date": inc_date.strftime("%Y-%m-%d"),
            "incident_type": incident_type,
            "severity": severity,
            "outage_duration_hrs": duration,
            "customers_affected": customers,
            "repair_cost_usd": repair_cost,
            "weather_related": weather_related,
            "root_cause": root_cause,
        })

    df = pd.DataFrame(rows)
    print(f"[incidents] Generated {len(df)} incidents ({INCIDENT_START} to {INCIDENT_END})")
    print(f"  By severity: {df['severity'].value_counts().to_dict()}")
    print(f"  By type: {df['incident_type'].value_counts().to_dict()}")
    print(f"  Weather-related: {df['weather_related'].sum()}")
    return df


if __name__ == "__main__":
    from generate_topology import generate_assets
    assets = generate_assets()
    df = generate_incidents(assets)
    df.to_csv("processed/historical_incidents.csv", index=False)
    print("Saved to processed/historical_incidents.csv")
