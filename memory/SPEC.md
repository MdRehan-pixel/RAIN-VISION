# RAIN VISION Living Specification

## Purpose
RAIN VISION is a Smart India Hackathon 2026 prototype command center for pan-India heavy rainfall and prototype inundation early warning. It combines public weather/model data, GIS context, deterministic prototype risk fusion, geofenced browser alerts, and resilient local caching.

## Data model
- `LocationState`: active name, optional state/country, exact latitude/longitude, optional GPS accuracy, and source (`GPS`, `SEARCH`, `MAP`, or explicit `DEMO_FALLBACK`).
- `ForecastEnvelope`: Open-Meteo forecast/model payload, provider, model, exact coordinates, fetch timestamp, and status.
- `RiskResult`: 0–100 deterministic score, category, weighted factors, recommendation, and prototype inundation result.
- `RegisteredLocation`: locally stored name, masked phone in the UI, optional email, active coordinates, alert radius, severity threshold, and save time.
- `CacheSnapshot`: successful forecast, risk, inundation, radar status, spatial points, location, timestamp, and local trend history.

## Key flows
1. On startup the browser requests native GPS. If unavailable or denied, Bengaluru is shown as an explicit DEMO fallback; users can search or click the map.
2. Active coordinates drive forecast, NWP status, spatial points, risk, inundation, alerts, and map context. Open-Meteo geocoding resolves search results.
3. Risk uses the prototype weights: rainfall 30%, probability 20%, accumulation 20%, NWP 15%, cloud/radar 5%, vulnerability proxy 10%.
4. Live snapshots are cached in localStorage. Real `online`/`offline` events and the jury simulation share one offline behavior; online recovery refetches live data.
5. Emergency demo mode progresses through normal → rainfall increase → moderate → high → extreme → alert/geofence → network failure → cached offline → network restored.
6. Registration is DEMO LOCAL REGISTRATION. Browser notifications are real where permission is granted. SMS is never claimed sent or delivered; the UI exposes a payload-ready future integration state.

## Honest provenance
- LIVE: Open-Meteo forecast/geocoding, ECMWF model response where accepted, RainViewer metadata when available, OSM map tiles.
- FALLBACK: cached live snapshot after a network/provider failure.
- DEMO: Bengaluru startup fallback and emergency scenario.
- SIMULATED: satellite/cloud adapter and prototype signals where an authorized feed is unavailable.
- FUTURE: SMS gateway, IMD/ISRO feeds, DEM/topography, drainage, hydrology, LoRa, cellular edge.
- UNAVAILABLE: provider data that cannot be safely represented.

## Auth and roles
No authentication or roles. Registration is local to the browser for this zero-budget MVP.