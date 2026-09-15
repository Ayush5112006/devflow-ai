"""
merge_to_db.py
──────────────
Loads all generated CSVs from processed/ into a SQLite database in output/.
"""

import sqlite3
import pandas as pd
from pathlib import Path

from config import OUTPUT_DIR, DB_PATH


def create_schema(conn: sqlite3.Connection) -> None:
    schema_path = Path(__file__).parent / "schema.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        conn.executescript(f.read())


def load_table(conn: sqlite3.Connection, csv_name: str, table_name: str) -> None:
    csv_path = OUTPUT_DIR / csv_name
    if not csv_path.exists():
        print(f"  [skip] {csv_path} not found")
        return
    df = pd.read_csv(csv_path)
    df.to_sql(table_name, conn, if_exists="replace", index=False)
    row_count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    print(f"  [loaded] {table_name}: {row_count:,} rows")


def merge_all() -> None:
    print("=" * 60)
    print("Merging data into SQLite:", DB_PATH)
    print("=" * 60)

    conn = sqlite3.connect(str(DB_PATH))
    create_schema(conn)

    load_table(conn, "assets.csv", "assets")
    load_table(conn, "sensor_readings.csv", "sensor_readings")
    load_table(conn, "weather_alerts.csv", "weather_alerts")
    load_table(conn, "historical_incidents.csv", "historical_incidents")
    load_table(conn, "grid_zones.csv", "grid_zones")

    print("\n--- Database Summary ---")
    for table in ["assets", "sensor_readings", "weather_alerts", "historical_incidents", "grid_zones"]:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table:25s} {count:>10,} rows")

    # Verify cross-file constraints
    print("\n--- Constraint Checks ---")
    # 1. All sensor asset_ids exist in assets
    q = """SELECT COUNT(DISTINCT s.asset_id) FROM sensor_readings s
           LEFT JOIN assets a ON s.asset_id = a.asset_id WHERE a.asset_id IS NULL"""
    orphan_sensors = conn.execute(q).fetchone()[0]
    print(f"  Sensor asset_ids not in assets table: {orphan_sensors}")

    # 2. All incident asset_ids exist in assets
    q = """SELECT COUNT(DISTINCT i.asset_id) FROM historical_incidents i
           LEFT JOIN assets a ON i.asset_id = a.asset_id WHERE a.asset_id IS NULL"""
    orphan_incidents = conn.execute(q).fetchone()[0]
    print(f"  Incident asset_ids not in assets table: {orphan_incidents}")

    # 3. All weather zones exist in assets
    q = """SELECT COUNT(DISTINCT w.zone) FROM weather_alerts w
           LEFT JOIN (SELECT DISTINCT zone FROM assets) a ON w.zone = a.zone WHERE a.zone IS NULL"""
    orphan_zones = conn.execute(q).fetchone()[0]
    print(f"  Weather zones not in assets table: {orphan_zones}")

    # 4. Sensor hourly coverage
    q = """SELECT asset_id, COUNT(DISTINCT timestamp) as n_hours
           FROM sensor_readings GROUP BY asset_id"""
    hourly_counts = pd.read_sql_query(q, conn)
    print(f"  Sensor hours per asset: min={hourly_counts['n_hours'].min()}, "
          f"max={hourly_counts['n_hours'].max()}, expected={30*24}")

    # Top riskiest assets
    print("\n--- Top 5 Riskiest Assets (by avg partial discharge) ---")
    q = """SELECT a.asset_id, a.asset_type, a.zone,
                  ROUND(AVG(s.partial_discharge_mv), 1) AS avg_pd_mv,
                  ROUND(AVG(s.temperature_c), 1) AS avg_temp_c,
                  MIN(s.oil_quality_index) AS min_oil_quality,
                  a.customers_served
           FROM sensor_readings s
           JOIN assets a ON s.asset_id = a.asset_id
           WHERE s.timestamp >= '2026-09-08T00:00:00'
           GROUP BY a.asset_id
           ORDER BY avg_pd_mv DESC
           LIMIT 5"""
    print(pd.read_sql_query(q, conn).to_string(index=False))

    conn.close()
    print(f"\nDatabase saved: {DB_PATH}")


if __name__ == "__main__":
    merge_all()
