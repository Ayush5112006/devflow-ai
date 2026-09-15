"""
verify_data.py
──────────────
Sanity checks against DATA_SCHEMA.md constraints.
"""
import sqlite3
import pandas as pd

conn = sqlite3.connect("output/grid_data.db")

print("=" * 60)
print("DATA SCHEMA VERIFICATION")
print("=" * 60)

# 1. Row counts
print("\n--- Row Counts ---")
for table in ["assets", "sensor_readings", "weather_alerts", "historical_incidents", "grid_zones"]:
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"  {table:25s} {count:>8,} rows")

# 2. Assets: type distribution and zone counts
print("\n--- Asset Type Distribution ---")
q = "SELECT asset_type, COUNT(*) n FROM assets GROUP BY asset_type"
print(pd.read_sql_query(q, conn).to_string(index=False))

print("\n--- Assets Per Zone ---")
q = "SELECT zone, COUNT(*) n FROM assets GROUP BY zone ORDER BY zone"
print(pd.read_sql_query(q, conn).to_string(index=False))

# 3. Asset ID format check
print("\n--- Asset ID Format ---")
q = "SELECT asset_id FROM assets ORDER BY asset_id LIMIT 10"
print(pd.read_sql_query(q, conn)["asset_id"].tolist())

# 4. Sensor coverage
print("\n--- Sensor Coverage ---")
q = """SELECT COUNT(DISTINCT asset_id) as n_assets,
              COUNT(*) as total_rows,
              MIN(timestamp) as min_ts, MAX(timestamp) as max_ts
       FROM sensor_readings"""
print(pd.read_sql_query(q, conn).to_string(index=False))

# 5. Sensor columns check
print("\n--- Sensor Columns ---")
q = "PRAGMA table_info(sensor_readings)"
cols = pd.read_sql_query(q, conn)["name"].tolist()
print(f"  Columns: {cols}")

# 6. Failure tier separation
print("\n--- Failure Tier Separation (avg partial_discharge_mv) ---")
q = """SELECT asset_id, AVG(partial_discharge_mv) avg_pd, AVG(temperature_c) avg_temp,
              MIN(oil_quality_index) min_oil
       FROM sensor_readings GROUP BY asset_id ORDER BY avg_pd DESC"""
tier_df = pd.read_sql_query(q, conn)
print(f"  Top 5 riskiest: {tier_df.head(5)['asset_id'].tolist()}")
print(f"  Bottom 5:       {tier_df.tail(5)['asset_id'].tolist()}")

# 7. Incidents
print("\n--- Incidents ---")
q = "SELECT severity, COUNT(*) n FROM historical_incidents GROUP BY severity"
print(pd.read_sql_query(q, conn).to_string(index=False))
q = "SELECT MIN(incident_date) mn, MAX(incident_date) mx FROM historical_incidents"
print(pd.read_sql_query(q, conn).to_string(index=False))

# 8. Weather alerts
print("\n--- Weather Alerts ---")
q = "SELECT alert_type, COUNT(*) n FROM weather_alerts GROUP BY alert_type"
print(pd.read_sql_query(q, conn).to_string(index=False))

# 9. Cross-file integrity
print("\n--- Cross-File Integrity ---")
q = """SELECT COUNT(*) FROM sensor_readings s
       LEFT JOIN assets a ON s.asset_id = a.asset_id WHERE a.asset_id IS NULL"""
orphan = conn.execute(q).fetchone()[0]
print(f"  Orphan sensor rows: {orphan}")

q = """SELECT COUNT(*) FROM historical_incidents i
       LEFT JOIN assets a ON i.asset_id = a.asset_id WHERE a.asset_id IS NULL"""
orphan2 = conn.execute(q).fetchone()[0]
print(f"  Orphan incident rows: {orphan2}")

conn.close()
print("\nAll checks complete.")
