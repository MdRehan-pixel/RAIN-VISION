from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ml.predict import predict
from lib.db import db
from routers.weather import _get_json, _weather_params, OPEN_METEO

router = APIRouter(prefix="/ml", tags=["ml-live"])


@router.get("/live")
async def live_ml_prediction(
    request: Request,
    latitude: float = Query(...),
    longitude: float = Query(...),
):
    try:
        params = _weather_params(latitude, longitude)

        data, cache_status, fetched_at = await _get_json(
            request,
            OPEN_METEO,
            params,
            300,
        )

        result = predict(data)

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Live ML weather fetch failed: {exc}",
        )

    now = datetime.now(timezone.utc)

    record = {
        "created_at": now,
        "fetched_at": fetched_at,
        "latitude": latitude,
        "longitude": longitude,
        "source": "Open-Meteo",
        "weather_status": cache_status,
        "prediction": result["prediction"],
        "risk_probability": result["risk_probability"],
        "category": result["category"],
        "features": result["features"],
        "model": result["model"],
    }

    if db is not None:
        await db.risk_predictions.insert_one(record)

    return {
        "status": "LIVE",
        "source": "Open-Meteo",
        "latitude": latitude,
        "longitude": longitude,
        "prediction": result["prediction"],
        "risk_probability": result["risk_probability"],
        "category": result["category"],
        "features": result["features"],
        "model": result["model"],
        "weather_status": cache_status,
        "predicted_at": now.isoformat(),
    }
