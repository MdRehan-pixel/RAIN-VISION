from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ForecastEnvelope(BaseModel):
    status: Literal["LIVE", "FALLBACK"]
    provider: str
    model: str
    latitude: float
    longitude: float
    fetched_at: datetime
    cached: bool = False
    data: dict[str, Any]


class GeoResult(BaseModel):
    id: int | None = None
    name: str
    latitude: float
    longitude: float
    country: str | None = None
    country_code: str | None = None
    admin1: str | None = None
    timezone: str | None = None


class GeocodeResponse(BaseModel):
    results: list[GeoResult] = Field(default_factory=list)
    status: Literal["LIVE", "FALLBACK"]
    fetched_at: datetime


class CityWeather(BaseModel):
    name: str
    latitude: float
    longitude: float
    current: dict[str, Any]


class PanIndiaResponse(BaseModel):
    status: Literal["LIVE", "FALLBACK"]
    fetched_at: datetime
    cities: list[CityWeather] = Field(default_factory=list)


class SpatialPoint(BaseModel):
    name: str
    latitude: float
    longitude: float
    distance_km: float
    current: dict[str, Any]


class SpatialResponse(BaseModel):
    status: Literal["LIVE", "FALLBACK"]
    radius_km: int
    fetched_at: datetime
    points: list[SpatialPoint] = Field(default_factory=list)


class RadarFrame(BaseModel):
    time: int
    tile_template: str


class RadarResponse(BaseModel):
    status: Literal["LIVE", "UNAVAILABLE"]
    generated: int | None = None
    fetched_at: datetime
    frames: list[RadarFrame] = Field(default_factory=list)