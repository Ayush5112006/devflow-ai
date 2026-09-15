"""
fetch_weather.py
----------------
LIVE mode — replaces generate_weather.py for production.

Uses the FREE OpenWeatherMap 5-Day / 3-Hour Forecast API:
    GET /data/2.5/forecast
    - 40 data points x 3-hour intervals = 5 days ahead
    - 100% free, no credit card needed
    - Called once per zone (5 calls total)

How it works:
    1. Fetch 40 x 3-hour forecast slots for each zone center
    2. Scan consecutive slots and GROUP them into alert events
       (e.g. 6 consecutive stormy 3-hour slots = one 18-hour storm alert)
    3. Write each alert event as one row — same weather_alerts.csv format
       that generate_weather.py produces synthetically

Same output columns:
    alert_id, zone, alert_type, severity, start_time, end_time,
    max_wind_kmh, max_temp_c, precipitation_mm, source

Usage:
    cd src/data
    python fetch_weather.py

Requirements:
    pip install requests python-dotenv
"""

import os
import requests
import pandas as pd
from datetime import datetime
from pathlib import Path

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

from config import ZONES, ZONE_CENTERS, OUTPUT_DIR

# ── API config ─────────────────────────────────────────────────────────────────
API_KEY  = os.getenv("OPENWEATHERMAP_API_KEY", "")
FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"  # FREE 5-day

# ── Classification thresholds ──────────────────────────────────────────────────
# Wind speed km/h → (alert_type, severity)
WIND_THRESHOLDS = [
    (120, "storm",     "CRITICAL"),
    (90,  "storm",     "HIGH"),
    (60,  "high_wind", "HIGH"),
    (40,  "high_wind", "MEDIUM"),
]

# Temperature C → (alert_type, severity)
HEAT_THRESHOLDS = [
    (45, "heatwave", "CRITICAL"),
    (42, "heatwave", "HIGH"),
    (38, "heatwave", "MEDIUM"),
]

# Precipitation mm per 3h slot → (alert_type, severity)
PRECIP_THRESHOLDS = [
    (60, "flood", "CRITICAL"),
    (35, "flood", "HIGH"),
    (15, "storm", "MEDIUM"),
    (4,  "storm", "LOW"),
]

# OWM condition ID ranges → (alert_type, base_severity)
# Metric thresholds override this if stronger
OWM_ID_MAP = [
    (range(200, 233), "storm",     "HIGH"),    # Thunderstorm
    (range(300, 322), "storm",     "LOW"),     # Drizzle
    (range(500, 532), "storm",     "MEDIUM"),  # Rain
    (range(600, 623), "ice_storm", "HIGH"),    # Snow / sleet
    (range(900, 902), "storm",     "CRITICAL"),# Extreme wind/tornado
    (range(771, 772), "storm",     "HIGH"),    # Squalls
]

SEVERITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def _classify_slot(slot: dict) -> tuple[str | None, str | None, float, float, float]:
    """
    Classify one 3-hour forecast slot.
    Returns (alert_type, severity, wind_kmh, temp_c, precip_mm).
    alert_type is None if conditions are not severe enough.
    """
    weather_id = slot["weather"][0]["id"]
    wind_kmh   = slot.get("wind", {}).get("speed", 0) * 3.6   # m/s -> km/h
    temp_c     = slot["main"]["temp"] - 273.15                  # K -> C
    # precipitation is mm per 3h in forecast endpoint
    precip_mm  = (
        slot.get("rain", {}).get("3h", 0)
        + slot.get("snow", {}).get("3h", 0)
    )

    alert_type = None
    severity   = None

    # Step 1: OWM condition ID
    for id_range, atype, sev in OWM_ID_MAP:
        if weather_id in id_range:
            alert_type, severity = atype, sev
            break

    # Step 2: metric thresholds override (stronger wins)
    for threshold, atype, sev in WIND_THRESHOLDS:
        if wind_kmh >= threshold:
            if alert_type is None or SEVERITY_RANK[sev] > SEVERITY_RANK[severity]:
                alert_type, severity = atype, sev
            break

    for threshold, atype, sev in HEAT_THRESHOLDS:
        if temp_c >= threshold:
            if alert_type is None or SEVERITY_RANK[sev] > SEVERITY_RANK[severity]:
                alert_type, severity = atype, sev
            break

    for threshold, atype, sev in PRECIP_THRESHOLDS:
        if precip_mm >= threshold:
            if alert_type is None or SEVERITY_RANK[sev] > SEVERITY_RANK[severity]:
                alert_type, severity = atype, sev
            break

    return alert_type, severity, round(wind_kmh, 1), round(temp_c, 1), round(precip_mm, 1)


def _group_into_events(slots: list[dict], zone: str) -> list[dict]:
    """
    Merge consecutive severe forecast slots into single alert events.
    E.g. 6 stormy 3-hour slots become one 18-hour storm alert.
    Returns list of alert dicts ready for the DataFrame.
    alert_id is set to a placeholder; caller reassigns globally unique IDs.
    """
    events = []

    i = 0
    while i < len(slots):
        slot = slots[i]
        atype, sev, wind, temp, precip = _classify_slot(slot)

        if atype is None:
            i += 1
            continue

        # Start of a new alert event — absorb consecutive matching slots
        event_start = slot["dt_txt"]           # "YYYY-MM-DD HH:MM:SS"
        event_end   = slot["dt_txt"]
        max_wind    = wind
        max_temp    = temp
        max_precip  = precip
        peak_sev    = sev
        peak_type   = atype

        j = i + 1
        while j < len(slots):
            next_atype, next_sev, nw, nt, np_ = _classify_slot(slots[j])
            if next_atype is None:
                break   # clear slot ends this event
            # Absorb into current event
            event_end  = slots[j]["dt_txt"]
            max_wind   = max(max_wind,   nw)
            max_temp   = max(max_temp,   nt)
            max_precip = max(max_precip, np_)
            if SEVERITY_RANK[next_sev] > SEVERITY_RANK[peak_sev]:
                peak_sev  = next_sev
                peak_type = next_atype
            j += 1

        # Convert "YYYY-MM-DD HH:MM:SS" -> ISO 8601 T format
        start_iso = event_start.replace(" ", "T")
        # end_time = 3h after the last absorbed slot
        end_dt = datetime.strptime(event_end, "%Y-%m-%d %H:%M:%S")
        from datetime import timedelta
        end_iso = (end_dt + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S")

        events.append({
            "alert_id":        "WX-LIVE-PENDING",
            "zone":            zone,
            "alert_type":      peak_type,
            "severity":        peak_sev,
            "start_time":      start_iso,
            "end_time":        end_iso,
            "max_wind_kmh":    max_wind   if max_wind  > 0 else None,
            "max_temp_c":      max_temp   if peak_type == "heatwave" else None,
            "precipitation_mm":max_precip if max_precip > 0 else None,
            "source":          "openweathermap",
        })

        i = j  # skip all absorbed slots

    return events


def fetch_weather_alerts() -> pd.DataFrame:
    """
    Fetch 5-day forecast from OpenWeatherMap for all 5 zone centers.
    Groups consecutive severe slots into alert events.
    Returns DataFrame in weather_alerts.csv format.
    """
    COLS = ["alert_id", "zone", "alert_type", "severity",
            "start_time", "end_time", "max_wind_kmh",
            "max_temp_c", "precipitation_mm", "source"]

    if not API_KEY:
        print("[fetch_weather] WARNING: OPENWEATHERMAP_API_KEY not set.")
        print("  Add it to src/.env  ->  OPENWEATHERMAP_API_KEY=your_key")
        print("  Using generate_weather.py synthetic data instead.")
        return pd.DataFrame(columns=COLS)

    all_events = []
    global_counter = 0

    for zone in ZONES:
        center = ZONE_CENTERS[zone]
        lat, lng = center["lat"], center["lng"]

        try:
            resp = requests.get(
                FORECAST_URL,
                params={
                    "lat":   lat,
                    "lon":   lng,
                    "appid": API_KEY,
                    "cnt":   40,        # 40 slots x 3h = 5 days (max free)
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as e:
            print(f"  [fetch_weather] API error for zone {zone}: {e}")
            continue

        slots  = data.get("list", [])
        events = _group_into_events(slots, zone)
        for ev in events:
            global_counter += 1
            ev["alert_id"] = f"WX-LIVE-{global_counter:04d}"
        all_events.extend(events)

        if events:
            print(f"  [fetch_weather] {zone}: {len(events)} alert event(s) over next 5 days")
            for ev in events:
                print(f"    {ev['alert_type']:12s} {ev['severity']:8s} "
                      f"{ev['start_time']} -> {ev['end_time']}  "
                      f"wind={ev['max_wind_kmh']} km/h  precip={ev['precipitation_mm']} mm")
        else:
            print(f"  [fetch_weather] {zone}: clear forecast — no alerts in next 5 days")

    df = pd.DataFrame(all_events) if all_events else pd.DataFrame(columns=COLS)
    df = df.reindex(columns=COLS)

    print(f"\n[fetch_weather] Total: {len(df)} alert events across {len(ZONES)} zones")
    print(f"  Forecast window: NOW  ->  +5 days (3-hour resolution, free tier)")
    return df


if __name__ == "__main__":
    print("=" * 60)
    print("  Telemetry Titans - Live 5-Day Weather Forecast Fetch")
    print("=" * 60)
    df = fetch_weather_alerts()
    out_path = OUTPUT_DIR / "weather_alerts.csv"
    df.to_csv(out_path, index=False)
    print(f"\nSaved {len(df)} alerts to {out_path}")
    if len(df) > 0:
        print("\n" + df.to_string(index=False))
    else:
        print("  (no severe weather forecast in next 5 days)")
