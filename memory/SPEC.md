# RAIN VISION Living Specification

## Purpose
RAIN VISION is a Smart India Hackathon 2026 prototype command center for pan-India heavy rainfall and prototype inundation early warning. It combines public weather/model data, GIS context, deterministic prototype risk fusion, geofenced browser alerts, and resilient local caching.

## Data model
- `LocationState`: active name, optional state/country, exact latitude/longitude, optional GPS accuracy, and source (`GPS`, `SEARCH`, `MAP`, or explicit `DEMO_FALLBACK`).
- `ForecastEnvelope`: Open-Meteo forecast/model payload, provider, model, exact coordinates, fetch timestamp, and status.
- `RiskResult`: 0–100 deterministic score, category, weighted factors, recommendation, and prototype inundation result.
- `RegisteredLocation`: locally stored name, masked phone in the UI, optional email, active coordinates, alert radius, severity threshold, and save time.
- `CacheSnapshot`: successful forecast, risk, inundation, radar status, spatial points, location, timestamp, and local trend history.
- `SmsDelivery`: server-side Twilio submission/callback record keyed by idempotency key and provider Message SID; stores only a masked recipient.

## Key flows
1. On startup the browser requests native GPS. If unavailable or denied, Bengaluru is shown as an explicit DEMO fallback; users can search or click the map.
2. Active coordinates drive forecast, NWP status, spatial points, risk, inundation, alerts, and map context. Open-Meteo geocoding resolves search results.
3. Risk uses the prototype weights: rainfall 30%, probability 20%, accumulation 20%, NWP 15%, cloud/radar 5%, vulnerability proxy 10%.
4. Live snapshots are cached in localStorage. Real `online`/`offline` events and the jury simulation share one offline behavior; online recovery refetches live data.
5. Emergency demo mode progresses through normal → rainfall increase → moderate → high → extreme → alert/geofence → network failure → cached offline → network restored.
6. Registration is DEMO LOCAL REGISTRATION. Browser notifications are real where permission is granted.
7. `GET /api/sms/config` verifies sender ownership against Twilio (cached 5 min) and reports `sender_verification` = VERIFIED / NOT_PROVISIONED / UNVERIFIED / NOT_CONFIGURED plus `account_type`. Automatic HIGH/EXTREME sends are ARMED only when the sender is VERIFIED; failed sends surface Twilio's real `error_code` and message. Twilio Programmable Messaging automatically submits only non-demo HIGH/EXTREME alerts for a registered E.164 recipient. Idempotency suppresses duplicates. `QUEUED`/`SENT`/`DELIVERED`/`FAILED` are displayed only from Twilio responses or signed status callbacks; demo stages never send real messages.

## Historical incident replay (backtest)
- Route `/historical`, page `frontend/src/pages/HistoricalReplay.tsx`, builder `frontend/src/lib/historical.ts`, dataset `data/historical/chennai_2015.json`, API `backend/routers/historical.py` (`GET /api/historical/incidents`, `GET /api/historical/incidents/{id}`, 404 for unknown id).
- ERA5 reanalysis hourly observations (HISTORICAL); probability/radar/satellite/NWP are `null` = UNAVAILABLE; vulnerability proxy 40 = PROTOTYPE.
- Steps: daily, 3-hourly across `replay.detailStart..detailEnd` (1–2 Dec 2015). Each step: peak hourly intensity, trailing 6 h/24 h accumulation, mean cloud → `fuseSignals` (same weights/thresholds as live, renormalised over available signals) + prototype inundation. Alert status: LOW→NO ALERT, MODERATE→WATCH, HIGH→WARNING, EXTREME→EXTREME WARNING.
- In this view the top badge reads HISTORICAL BACKTEST MODE, live forecast/spatial/pan-India/radar queries are disabled, and the auto-SMS effect is skipped. Replay never mutates live risk state.
- Controls: Run historical replay, Play/Pause, Next step, Reset. Comparison card appears on completion; no accuracy metric is claimed.

## Honest provenance
- LIVE: Open-Meteo forecast/geocoding, ECMWF model response where accepted, RainViewer metadata when available, OSM map tiles, and Twilio SMS submission/status callbacks when fully configured.
- FALLBACK: cached live snapshot after a network/provider failure.
- DEMO: Bengaluru startup fallback and emergency scenario.
- SIMULATED: satellite/cloud adapter and prototype signals where an authorized feed is unavailable.
- FUTURE: IMD/ISRO feeds, DEM/topography, drainage, hydrology, LoRa, and cellular edge. `DemoSmsAdapter` remains the explicit fallback whenever Twilio configuration is incomplete.
- UNAVAILABLE: provider data that cannot be safely represented.

## Auth and roles
No authentication or roles. Registration is local to the browser for this zero-budget MVP.