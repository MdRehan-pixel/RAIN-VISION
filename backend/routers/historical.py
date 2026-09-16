"""Historical incident datasets for replay/backtesting.

Datasets are static JSON files under /app/data/historical. Only values actually present in
the file are served; `null` stays `null` so the UI can mark variables UNAVAILABLE.
"""
import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException

from models.historical import HistoricalIncident, IncidentListResponse, IncidentSummary

router = APIRouter(prefix="/historical")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "historical"


@lru_cache(maxsize=8)
def load_incidents() -> dict[str, HistoricalIncident]:
    incidents: dict[str, HistoricalIncident] = {}
    for path in sorted(DATA_DIR.glob("*.json")):
        with path.open() as handle:
            dataset = HistoricalIncident.model_validate(json.load(handle))
        incidents[dataset.incident.id] = dataset
    return incidents


@router.get("/incidents", response_model=IncidentListResponse)
async def list_incidents():
    summaries = [
        IncidentSummary(
            id=dataset.incident.id,
            name=dataset.incident.name,
            location=dataset.incident.location,
            period=dataset.incident.period,
            eventType=dataset.incident.eventType,
            dataType=dataset.incident.dataType,
            primaryDemo=dataset.incident.primaryDemo,
            observationCount=len(dataset.observations),
            status="READY FOR REPLAY",
        )
        for dataset in load_incidents().values()
    ]
    return IncidentListResponse(incidents=summaries)


@router.get("/incidents/{incident_id}", response_model=HistoricalIncident)
async def get_incident(incident_id: str):
    dataset = load_incidents().get(incident_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="historical incident not found in prototype dataset")
    return dataset
