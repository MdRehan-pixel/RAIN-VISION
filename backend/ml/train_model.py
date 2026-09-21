from pathlib import Path
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "artifacts"
DATA_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)

rng = np.random.default_rng(42)
n = 150

rain_1h = rng.gamma(2.2, 4.0, n)
rain_3h = rain_1h * rng.uniform(1.5, 3.8, n)
rain_6h = rain_3h * rng.uniform(1.4, 2.4, n)
rain_24h = rain_6h * rng.uniform(2.0, 5.0, n)
precip_prob = np.clip(rng.normal(65, 25, n), 0, 100)
humidity = np.clip(rng.normal(78, 12, n), 35, 100)
cloud = np.clip(rng.normal(75, 20, n), 10, 100)
pressure = np.clip(rng.normal(1008, 8, n), 980, 1035)
wind = np.clip(rng.normal(12, 7, n), 0, 45)

# Transparent prototype target:
# higher accumulated rainfall + high precipitation probability + humidity
# increase the likelihood of the "high-risk" class.
raw_score = (
    rain_1h * 4.0
    + rain_3h * 1.7
    + rain_6h * 0.9
    + rain_24h * 0.35
    + precip_prob * 0.18
    + humidity * 0.08
    + cloud * 0.04
    - wind * 0.05
)

threshold = np.quantile(raw_score, 0.70)
risk = (raw_score >= threshold).astype(int)

df = pd.DataFrame({
    "rain_1h_mm": rain_1h,
    "rain_3h_mm": rain_3h,
    "rain_6h_mm": rain_6h,
    "rain_24h_mm": rain_24h,
    "precip_probability": precip_prob,
    "humidity": humidity,
    "cloud_cover": cloud,
    "surface_pressure": pressure,
    "wind_speed": wind,
    "risk_high": risk,
})

df.to_csv(DATA_DIR / "rain_risk_dataset.csv", index=False)

features = [
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

X = df[features]
y = df["risk_high"]

X_train, X_temp, y_train, y_temp = train_test_split(
    X, y, test_size=0.30, random_state=42, stratify=y
)
X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
)

model = Pipeline([
    ("scale", StandardScaler()),
    ("classifier", RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        random_state=42,
        class_weight="balanced",
    )),
])

model.fit(X_train, y_train)

val_pred = model.predict(X_val)
test_pred = model.predict(X_test)

metrics = {
    "dataset_records": int(len(df)),
    "train_records": int(len(X_train)),
    "validation_records": int(len(X_val)),
    "test_records": int(len(X_test)),
    "validation_accuracy": float(accuracy_score(y_val, val_pred)),
    "test_accuracy": float(accuracy_score(y_test, test_pred)),
    "test_confusion_matrix": confusion_matrix(y_test, test_pred).tolist(),
    "classification_report": classification_report(
        y_test, test_pred, output_dict=True
    ),
    "features": features,
    "target": "risk_high",
    "target_definition": "Prototype high-risk label derived from rainfall and atmospheric conditions; not measured flood ground truth.",
}

joblib.dump(model, MODEL_DIR / "rain_risk_model.joblib")

with open(MODEL_DIR / "metrics.json", "w") as f:
    json.dump(metrics, f, indent=2)

print("MODEL_TRAINED")
print(f"records={len(df)}")
print(f"train={len(X_train)} validation={len(X_val)} test={len(X_test)}")
print(f"validation_accuracy={metrics['validation_accuracy']:.3f}")
print(f"test_accuracy={metrics['test_accuracy']:.3f}")
print(f"model={MODEL_DIR / 'rain_risk_model.joblib'}")
print(f"dataset={DATA_DIR / 'rain_risk_dataset.csv'}")
