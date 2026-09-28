#!/usr/bin/env python3
"""
Train GradientBoosting model on full.csv.
Produces artifacts in api/model/ and copies them to public/model/.
"""

import json, pickle, shutil
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.preprocessing import LabelEncoder

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "api" / "model"
PUBLIC_MODEL_DIR = ROOT / "public" / "model"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_MODEL_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLUMNS = [
    "oni_value", "rainfall_deviation", "temperature_anomaly", "drought_index",
    "crop_production_index", "crop_yield_tons_ha", "agricultural_loss_pct", "irrigation_coverage_pct",
    "malnutrition_pct", "food_security_index", "infant_mortality_rate", "stunting_pct",
]

FEATURE_DESCRIPTIONS = {
    "oni_value": "El Nino / ONI Index",
    "rainfall_deviation": "Rainfall Deviation",
    "temperature_anomaly": "Temperature Anomaly",
    "drought_index": "Drought Severity Index",
    "crop_production_index": "Crop Production Index",
    "crop_yield_tons_ha": "Crop Yield (tons/ha)",
    "agricultural_loss_pct": "Agricultural Loss (%)",
    "irrigation_coverage_pct": "Irrigation Coverage (%)",
    "malnutrition_pct": "Child Malnutrition (%)",
    "food_security_index": "Food Security Index",
    "infant_mortality_rate": "Infant Mortality (per 1000)",
    "stunting_pct": "Child Stunting (%)",
}

FEATURE_GROUPS = {
    "Climate": ["oni_value", "rainfall_deviation", "temperature_anomaly", "drought_index"],
    "Agriculture": ["crop_production_index", "crop_yield_tons_ha", "agricultural_loss_pct", "irrigation_coverage_pct"],
    "Health & Food Security": ["malnutrition_pct", "food_security_index", "infant_mortality_rate", "stunting_pct"],
}


def train():
    csv_file = MODEL_DIR / "full.csv"
    if not csv_file.exists():
        csv_file = PUBLIC_MODEL_DIR / "full.csv"
    df = pd.read_csv(csv_file)
    print(f"Loaded {len(df)} records from {csv_file}")

    regions = sorted(df["region"].unique().tolist())
    le = LabelEncoder()
    df["region_enc"] = le.fit_transform(df["region"])

    feats = ["region_enc", "year"] + FEATURE_COLUMNS
    X, y = df[feats].values, df["risk_score"].values
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(
        n_estimators=250, max_depth=6, learning_rate=0.08,
        subsample=0.85, random_state=42, loss="squared_error"
    )
    model.fit(Xtr, ytr)

    yp = model.predict(Xte)
    mae = round(float(mean_absolute_error(yte, yp)), 3)
    rmse = round(float(root_mean_squared_error(yte, yp)), 3)
    r2 = round(float(r2_score(yte, yp)), 3)

    metrics = {
        "r2": r2,
        "mae": mae,
        "rmse": rmse,
        "train_size": len(Xtr),
        "test_size": len(Xte),
        "total_records": len(df),
        "regions_count": len(regions),
        "year_min": int(df["year"].min()),
        "year_max": int(df["year"].max()),
        "model_type": "GradientBoosting"
    }

    fi = {feats[i]: round(float(model.feature_importances_[i]), 4) for i in range(len(feats))}
    fi = dict(sorted(fi.items(), key=lambda x: x[1], reverse=True))

    artifacts = {
        "model": model,
        "label_encoder": le,
        "feature_columns": feats,
        "feature_descriptions": FEATURE_DESCRIPTIONS,
        "feature_importance": fi,
        "metrics": metrics,
        "regions": regions,
    }

    meta = {
        "regions": regions,
        "features": FEATURE_COLUMNS,
        "descriptions": FEATURE_DESCRIPTIONS,
        "groups": FEATURE_GROUPS,
        "model_type": "sklearn.GradientBoosting"
    }

    # Save to MODEL_DIR
    with open(MODEL_DIR / "model.pkl", "wb") as f:
        pickle.dump(artifacts, f)
    with open(MODEL_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(MODEL_DIR / "meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    # Sync to PUBLIC_MODEL_DIR
    shutil.copy2(MODEL_DIR / "model.pkl", PUBLIC_MODEL_DIR / "model.pkl")
    shutil.copy2(MODEL_DIR / "metrics.json", PUBLIC_MODEL_DIR / "metrics.json")
    shutil.copy2(MODEL_DIR / "meta.json", PUBLIC_MODEL_DIR / "meta.json")
    if csv_file.resolve() != (PUBLIC_MODEL_DIR / "full.csv").resolve():
        shutil.copy2(csv_file, PUBLIC_MODEL_DIR / "full.csv")
    if csv_file.resolve() != (MODEL_DIR / "full.csv").resolve():
        shutil.copy2(csv_file, MODEL_DIR / "full.csv")

    print(f"Model trained successfully on {len(df)} samples across {len(regions)} regions ({metrics['year_min']}-{metrics['year_max']})!")
    print(f"Metrics: R²={metrics['r2']}, MAE={metrics['mae']}, RMSE={metrics['rmse']}")
    print(f"Artifacts synced to {MODEL_DIR} and {PUBLIC_MODEL_DIR}")
    return artifacts


if __name__ == "__main__":
    train()

