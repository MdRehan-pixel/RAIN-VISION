from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ml.predict import predict
from lib.db import db

router = APIRouter(prefix="/ml", tags=["ml"])


@router.post("/predict")
async def predict_live(request: Request, payload: dict[str, Any]):
    data = payload.get("data", payload)

    try:
        result = predict(data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"ML prediction failed: {exc}",
        )

    now = datetime.now(timezone.utc)

    result["status"] = "LIVE"
    result["predicted_at"] = now.isoformat()
    result["latitude"] = payload.get("latitude")
    result["longitude"] = payload.get("longitude")

    # Store the raw ML prediction for verification/audit.
    if db is not None:
        await db.risk_predictions.insert_one({
            "created_at": now,
            "status": "LIVE",
            "latitude": payload.get("latitude"),
            "longitude": payload.get("longitude"),
            "prediction": result["prediction"],
            "risk_probability": result["risk_probability"],
            "category": result["category"],
            "features": result["features"],
            "model": result["model"],
        })

    return result



@router.post("/sync")
async def sync_offline_records(payload: dict[str, Any]):
    records = payload.get("records", [])

    if not isinstance(records, list):
        raise HTTPException(status_code=400, detail="records must be a list")

    if len(records) > 50:
        records = records[:50]

    if db is None:
        return {
            "status": "MONGODB_NOT_CONFIGURED",
            "synced": 0,
        }

    now = datetime.now(timezone.utc)
    documents = []

    for record in records:
        documents.append({
            "created_at": now,
            "synced_at": now,
            "sync_mode": "OFFLINE_QUEUE",
            "record_id": record.get("id"),
            "captured_at": record.get("captured_at"),
            "latitude": record.get("latitude"),
            "longitude": record.get("longitude"),
            "location": record.get("location"),
            "ml": record.get("ml"),
            "forecast": record.get("forecast"),
            "risk": record.get("risk"),
            "source": record.get("source", "browser-offline-cache"),
        })

    if documents:
        await db.offline_events.insert_many(documents)

    return {
        "status": "LIVE",
        "synced": len(documents),
        "collection": "offline_events",
        "synced_at": now.isoformat(),
    }


@router.get("/records")
async def get_ml_records(limit: int = 20):
    limit = max(1, min(limit, 100))

    if db is None:
        return {
            "status": "MONGODB_NOT_CONFIGURED",
            "records": [],
        }

    cursor = (
        db.risk_predictions
        .find({}, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
    )

    records = await cursor.to_list(length=limit)

    for record in records:
        if isinstance(record.get("created_at"), datetime):
            record["created_at"] = record["created_at"].isoformat()

    return {
        "status": "LIVE",
        "count": len(records),
        "records": records,
    }
@router.get("/offline-records")
async def get_offline_records(limit: int = 20):
    """Return raw offline queue records synced to MongoDB."""
    if db is None:
        return {
            "status": "MONGODB_NOT_CONFIGURED",
            "records": [],
        }

    limit = max(1, min(limit, 100))

    cursor = (
        db.offline_events
        .find({}, {"_id": 0})
        .sort("synced_at", -1)
        .limit(limit)
    )

    records = await cursor.to_list(length=limit)

    return {
        "status": "LIVE",
        "collection": "offline_events",
        "count": len(records),
        "records": records,
    }