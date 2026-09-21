from pathlib import Path
import joblib
import pandas as pd

MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "rain_risk_model.joblib"

FEATURES = [
    "rain_1h_mm",
    "rain_3h_mm",
    "rain_6h_mm",
    "rain_24h_mm",
    "precip_probability",
    "humidity",
    "cloud_cover",
    "surface_pressure",
    "wind_speed",
]

_model = None

def get_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model

def build_features(data: dict) -> dict:
    current = data.get("current", {})
    hourly = data.get("hourly", {})

    precipitation = [
        float(x or 0)
        for x in hourly.get("precipitation", [])[:24]
    ]

    rain_1h = precipitation[0] if precipitation else float(
        current.get("precipitation", current.get("rain", 0)) or 0
    )

    rain_3h = sum(precipitation[:3])
    rain_6h = sum(precipitation[:6])
    rain_24h = sum(precipitation[:24])

    probability = [
        float(x or 0)
        for x in hourly.get("precipitation_probability", [])[:24]
    ]

    return {
        "rain_1h_mm": rain_1h,
        "rain_3h_mm": rain_3h,
        "rain_6h_mm": rain_6h,
        "rain_24h_mm": rain_24h,
        "precip_probability": max(probability) if probability else 0,
        "humidity": float(current.get("relative_humidity_2m", 0) or 0),
        "cloud_cover": float(current.get("cloud_cover", 0) or 0),
        "surface_pressure": float(current.get("surface_pressure", 0) or 0),
        "wind_speed": float(current.get("wind_speed_10m", 0) or 0),
    }

def predict(data: dict) -> dict:
    features = build_features(data)
    frame = pd.DataFrame([features], columns=FEATURES)

    model = get_model()
    probability = float(model.predict_proba(frame)[0][1])
    prediction = int(model.predict(frame)[0])

    if probability >= 0.80:
        category = "EXTREME"
    elif probability >= 0.60:
        category = "HIGH"
    elif probability >= 0.35:
        category = "MODERATE"
    else:
        category = "LOW"

    return {
        "prediction": prediction,
        "risk_probability": round(probability * 100, 2),
        "category": category,
        "features": features,
        "model": "RandomForest prototype",
    }
