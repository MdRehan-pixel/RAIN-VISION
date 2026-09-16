from typing import Literal

from pydantic import BaseModel

HistoricalStatus = Literal["HISTORICAL", "DERIVED", "PROTOTYPE", "UNAVAILABLE"]


class IncidentLocation(BaseModel):
    city: str
    state: str
    country: str
    latitude: float
    longitude: float


class IncidentPeriod(BaseModel):
    start: str
    end: str


class IncidentInfo(BaseModel):
    id: str
    name: str
    location: IncidentLocation
    period: IncidentPeriod
    eventType: str
    dataType: Literal["HISTORICAL"]
    primaryDemo: bool = False
    summary: str


class Provenance(BaseModel):
    source: str
    sourceUrl: str
    retrievedAt: str
    gridLatitude: float
    gridLongitude: float
    gridElevationM: float
    timezone: str
    resolution: str
    dataType: Literal["HISTORICAL"]
    status: Literal["HISTORICAL"]
    note: str


class VariableMeta(BaseModel):
    key: str
    label: str
    unit: str
    status: HistoricalStatus
    source: str


class DocumentedFact(BaseModel):
    label: str
    value: str
    source: str


class Observation(BaseModel):
    """One historical timestep. `None` means genuinely unavailable - never filled."""

    timestamp: str
    rainfall: float | None
    precipitationProbability: float | None
    temperature: float | None
    humidity: float | None
    windSpeed: float | None
    cloudCover: float | None
    surfacePressure: float | None = None
    radarSignal: float | None
    satelliteSignal: float | None
    nwpSignal: float | None
    vulnerabilityProxy: float | None


class ReplayConfig(BaseModel):
    detailStart: str
    detailEnd: str
    detailStepHours: int = 3
    note: str


class HistoricalIncident(BaseModel):
    incident: IncidentInfo
    replay: ReplayConfig | None = None
    provenance: Provenance
    variables: list[VariableMeta]
    documentedFacts: list[DocumentedFact]
    unavailable: list[str]
    observations: list[Observation]


class IncidentSummary(BaseModel):
    id: str
    name: str
    location: IncidentLocation
    period: IncidentPeriod
    eventType: str
    dataType: Literal["HISTORICAL"]
    primaryDemo: bool
    observationCount: int
    status: Literal["READY FOR REPLAY"]


class IncidentListResponse(BaseModel):
    incidents: list[IncidentSummary]
