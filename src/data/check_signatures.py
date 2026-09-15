"""Check failure signature patterns of a near-failure asset against DATA_SCHEMA.md."""
import sqlite3
import pandas as pd

conn = sqlite3.connect("output/grid_data.db")
df = pd.read_sql_query(
    """SELECT timestamp, temperature_c, vibration_mm_s, oil_quality_index, partial_discharge_mv
       FROM sensor_readings WHERE asset_id='SUB-032' ORDER BY timestamp""",
    conn,
)
df["d"] = pd.to_datetime(df["timestamp"]).dt.strftime("%m-%d")
print("=== SUB-032 (near_failure) hourly sample every 6h ===")
print(df.iloc[::6, :5].to_string(index=False))

print("\n=== Day 1 vs Day 30 comparison ===")
day1 = df.iloc[0]
day30 = df.iloc[-1]
print(f"  temperature_c:      {day1.temperature_c}C -> {day30.temperature_c}C (expect +~15C rise)")
print(f"  vibration_mm_s:     {day1.vibration_mm_s} -> {day30.vibration_mm_s} (expect spike at end)")
print(f"  oil_quality_index:  {day1.oil_quality_index} -> {day30.oil_quality_index} (expect drop toward <30)")
print(f"  partial_discharge_mv: {day1.partial_discharge_mv} -> {day30.partial_discharge_mv} (expect >500)")

print("\n=== Max vibration (last 72h vs rest) ===")
last72 = df.tail(72)
rest = df.iloc[:-72]
print(f"  Max vib last 72h: {last72.vibration_mm_s.max():.1f} mm/s")
print(f"  Max vib before:   {rest.vibration_mm_s.max():.1f} mm/s")

conn.close()