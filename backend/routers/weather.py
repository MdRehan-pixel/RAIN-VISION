import math
from datetime import datetime, timedelta, timezone
from time import monotonic
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from models.weather import (
    CityWeather,
    ForecastEnvelope,
    GeocodeResponse,
    GeoResult,
    PanIndiaResponse,
    RadarFrame,
    RadarResponse,
    SpatialPoint,
    SpatialResponse,
)

router = APIRouter()

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
GEOCODING = "https://geocoding-api.open-meteo.com/v1/search"
RAINVIEWER = "https://api.rainviewer.com/public/weather-maps.json"

_cache: dict[str, tuple[float, dict[str, Any], datetime]] = {}

PAN_INDIA_CITIES = [
    ("Delhi", 28.6139, 77.2090),
    ("Mumbai", 19.0760, 72.8777),
    ("Bengaluru", 12.9716, 77.5946),
    ("Chennai", 13.0827, 80.2707),
    ("Hyderabad", 17.3850, 78.4867),
    ("Kolkata", 22.5726, 88.3639),
    ("Pune", 18.5204, 73.8567),
    ("Guwahati", 26.1445, 91.7362),
    ("Kochi", 9.9312, 76.2673),
    ("Ahmedabad", 23.0225, 72.5714),
    ("Lucknow", 26.8467, 80.9462),
    ("Patna", 25.5941, 85.1376),
    ("Srinagar", 34.0837, 74.7973),
    ("Bhubaneswar", 20.2961, 85.8245),
    ("Jaipur", 26.9124, 75.7873),
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cache_key(url: str, params: dict[str, Any]) -> str:
    return f"{url}?{urlencode(sorted(params.items()))}"


async def _get_json(request: Request, url: str, params: dict[str, Any], ttl: int) -> tuple[dict[str, Any], bool, datetime]:
    key = _cache_key(url, params)
    hit = _cache.get(key)
    now = monotonic()
    if hit and now - hit[0] < ttl:
        return hit[1], True, hit[2]
    try:
        response = await request.app.state.http.get(url, params=params)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("unexpected upstream payload")
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="upstream weather service unavailable") from exc
    fetched_at = _now()
    _cache[key] = (now, payload, fetched_at)
    return payload, False, fetched_at


def _weather_params(latitude: str | float, longitude: str | float, *, forecast_days: int = 3) -> dict[str, Any]:
    return {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,cloud_cover,surface_pressure,wind_speed_10m",
        "hourly": "precipitation,rain,showers,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover",
        "forecast_days": forecast_days,
        "timezone": "auto",
        "models": "ecmwf_ifs025",
    }


def _fallback_payload(latitude: float, longitude: float) -> dict[str, Any]:
    precipitation = [2.2, 3.1, 4.8, 5.2, 3.5, 2.4, 1.9, 1.2, 0.8, 0.5, 0.4, 0.2] + [0.1] * 12
    probability = [86, 83, 80, 77, 74, 71, 68, 64, 60, 56, 52, 48] + [42] * 12
    return {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": "Asia/Kolkata",
        "current": {"temperature_2m": 24, "relative_humidity_2m": 78, "precipitation": 2.2, "rain": 2.2, "showers": 0, "weather_code": 61, "cloud_cover": 82, "surface_pressure": 1008, "wind_speed_10m": 12},
        "hourly": {"time": [(_now() + timedelta(hours=index)).isoformat() for index in range(24)], "precipitation": precipitation, "rain": precipitation, "showers": [0] * 24, "precipitation_probability": probability, "temperature_2m": [24] * 24, "relative_humidity_2m": [78] * 24, "wind_speed_10m": [12] * 24, "cloud_cover": [82] * 24},
    }


@router.get("/forecast", response_model=ForecastEnvelope)
async def get_forecast(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
):
    params = _weather_params(latitude, longitude)
    try:
        data, cached, fetched_at = await _get_json(request, OPEN_METEO, params, 300)
        model = "ECMWF IFS"
    except HTTPException:
        params["models"] = "auto"
        try:
            data, cached, fetched_at = await _get_json(request, OPEN_METEO, params, 300)
            model = "Open-Meteo auto model"
        except HTTPException:
            data, cached, fetched_at = _fallback_payload(latitude, longitude), False, _now()
            return ForecastEnvelope(status="FALLBACK", provider="RAIN VISION demo adapter", model="Fallback weather profile", latitude=latitude, longitude=longitude, fetched_at=fetched_at, cached=False, data=data)
    return ForecastEnvelope(
        status="LIVE",
        provider="Open-Meteo",
        model=model,
        latitude=latitude,
        longitude=longitude,
        fetched_at=fetched_at,
        cached=cached,
        data=data,
    )


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode(
    request: Request,
    name: str = Query(min_length=2, max_length=80),
    country_code: str = Query(default="IN", alias="countryCode", min_length=2, max_length=2),
):
    params = {"name": name, "count": 6, "language": "en", "format": "json", "countryCode": country_code.upper()}
    data, _, fetched_at = await _get_json(request, GEOCODING, params, 3600)
    results = [GeoResult(**result) for result in data.get("results", [])]
    return GeocodeResponse(results=results, status="LIVE", fetched_at=fetched_at)


@router.get("/radar", response_model=RadarResponse)
async def radar(request: Request):
    try:
        data, _, fetched_at = await _get_json(request, RAINVIEWER, {}, 300)
    except HTTPException:
        return RadarResponse(status="UNAVAILABLE", fetched_at=_now())
    host = data.get("host")
    past = data.get("radar", {}).get("past", []) if isinstance(data.get("radar"), dict) else []
    if not host or not past:
        return RadarResponse(status="UNAVAILABLE", generated=data.get("generated"), fetched_at=fetched_at)
    frames = [
        RadarFrame(time=int(frame["time"]), tile_template=f"{host}{frame['path']}/256/{{z}}/{{x}}/{{y}}/2/1_0.png")
        for frame in past[-6:]
        if "time" in frame and "path" in frame
    ]
    return RadarResponse(status="LIVE" if frames else "UNAVAILABLE", generated=data.get("generated"), fetched_at=fetched_at, frames=frames)


async def _multi_current(request: Request, cities: list[tuple[str, float, float]]) -> tuple[list[dict[str, Any]], datetime]:
    params = _weather_params(",".join(str(city[1]) for city in cities), ",".join(str(city[2]) for city in cities), forecast_days=1)
    params["hourly"] = "precipitation,precipitation_probability"
    data, _, fetched_at = await _get_json(request, OPEN_METEO, params, 300)
    return (data if isinstance(data, list) else [data]), fetched_at


@router.get("/pan-india", response_model=PanIndiaResponse)
async def pan_india(request: Request):
    try:
        values, fetched_at = await _multi_current(request, PAN_INDIA_CITIES)
    except HTTPException:
        return PanIndiaResponse(status="FALLBACK", fetched_at=_now())
    cities = [
        CityWeather(name=city[0], latitude=city[1], longitude=city[2], current=value.get("current", {}))
        for city, value in zip(PAN_INDIA_CITIES, values)
    ]
    return PanIndiaResponse(status="LIVE", fetched_at=fetched_at, cities=cities)


@router.get("/spatial", response_model=SpatialResponse)
async def spatial(
    request: Request,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: int = Query(default=10, alias="radiusKm", ge=5, le=50),
):
    offsets = [("NW", -1, 1), ("N", 0, 1), ("NE", 1, 1), ("W", -1, 0), ("CENTER", 0, 0), ("E", 1, 0), ("SW", -1, -1), ("S", 0, -1), ("SE", 1, -1)]
    lat_step = radius_km / 111.0
    lon_step = radius_km / max(111.0 * math.cos(math.radians(latitude)), 1.0)
    points = [(name, latitude + lat_step * y, longitude + lon_step * x) for name, x, y in offsets]
    requests = [(name, lat, lon) for name, lat, lon in points]
    try:
        values, fetched_at = await _multi_current(request, requests)
    except HTTPException:
        return SpatialResponse(status="FALLBACK", radius_km=radius_km, fetched_at=_now())
    spatial_points = [
        SpatialPoint(
            name=point[0],
            latitude=point[1],
            longitude=point[2],
            distance_km=round(math.hypot(x, y) * radius_km, 1),
            current=value.get("current", {}),
        )
        for (point, (_, x, y)), value in zip(zip(points, offsets), values)
    ]
    return SpatialResponse(status="LIVE", radius_km=radius_km, fetched_at=fetched_at, points=spatial_points)