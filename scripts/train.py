#!/usr/bin/env python3
"""
Generate synthetic datasets + train XGBoost model.
Run once before deployment to produce artifacts in api/model/ and api/data/.
"""

import json, pickle, sys
from pathlib import Path
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
from sklearn.preprocessing import LabelEncoder

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "api" / "data"
MODEL_DIR = ROOT / "api" / "model"
DATA_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)

REGIONS = [
    "Bihar", "Jharkhand", "Odisha", "Chhattisgarh", "Madhya Pradesh",
    "Rajasthan", "Gujarat", "Maharashtra", "Karnataka", "Andhra Pradesh",
    "Telangana", "Tamil Nadu", "Kerala", "West Bengal", "Assam",
    "Uttar Pradesh", "Haryana", "Punjab", "Uttarakhand", "Goa",
]

EL_NINO_YEARS = {1982,1983,1987,1988,1991,1992,1994,1997,1998,
                  2002,2003,2004,2006,2007,2009,2010,2012,2014,
                  2015,2016,2018,2019,2023,2024}

REGION_BASE_RISK = {
    "Bihar":0.72,"Jharkhand":0.68,"Odisha":0.65,"Chhattisgarh":0.62,
    "Madhya Pradesh":0.58,"Rajasthan":0.55,"Gujarat":0.48,
    "Maharashtra":0.45,"Karnataka":0.50,"Andhra Pradesh":0.52,
    "Telangana":0.49,"Tamil Nadu":0.42,"Kerala":0.30,"West Bengal":0.60,
    "Assam":0.58,"Uttar Pradesh":0.63,"Haryana":0.40,"Punjab":0.38,
    "Uttarakhand":0.44,"Goa":0.28,
}

FEATURE_COLUMNS = [
    "oni_value","rainfall_deviation","temperature_anomaly","drought_index",
    "crop_production_index","crop_yield_tons_ha","agricultural_loss_pct","irrigation_coverage_pct",
    "malnutrition_pct","food_security_index","infant_mortality_rate","stunting_pct",
]

FEATURE_DESCRIPTIONS = {
    "oni_value":"El Niño / ONI Index","rainfall_deviation":"Rainfall Deviation",
    "temperature_anomaly":"Temperature Anomaly","drought_index":"Drought Severity Index",
    "crop_production_index":"Crop Production Index","crop_yield_tons_ha":"Crop Yield (tons/ha)",
    "agricultural_loss_pct":"Agricultural Loss (%)","irrigation_coverage_pct":"Irrigation Coverage (%)",
    "malnutrition_pct":"Child Malnutrition (%)","food_security_index":"Food Security Index",
    "infant_mortality_rate":"Infant Mortality (per 1000)","stunting_pct":"Child Stunting (%)",
}

FEATURE_GROUPS = {
    "Climate":["oni_value","rainfall_deviation","temperature_anomaly","drought_index"],
    "Agriculture":["crop_production_index","crop_yield_tons_ha","agricultural_loss_pct","irrigation_coverage_pct"],
    "Health & Food Security":["malnutrition_pct","food_security_index","infant_mortality_rate","stunting_pct"],
}


# ── Data Generation ──────────────────────────────────────────────

def generate_datasets(seed=42):
    rng = np.random.default_rng(seed)
    years = list(range(1994, 2024))
    climate_rows, agri_rows, health_rows = [], [], []

    for year in years:
        is_en = year in EL_NINO_YEARS
        for region in REGIONS:
            br = REGION_BASE_RISK[region]
            oni = rng.normal(1.5, 0.6) if is_en else rng.normal(-0.2, 0.8)
            oni = float(np.clip(oni, -2.5, 3.0))
            rain = float(np.clip(-0.15*oni + rng.normal(0,0.3), -2.0, 1.5))
            temp = float(np.clip(0.08*oni + rng.normal(0,0.2), -1.0, 2.0))
            drought = float(np.clip(0.3 + 0.15*oni - 0.2*rain + rng.normal(0,0.1), 0, 1))
            climate_rows.append(dict(year=year,region=region,oni_value=round(oni,2),
                rainfall_deviation=round(rain,3),temperature_anomaly=round(temp,3),drought_index=round(drought,3)))

            prod = float(np.clip(100 - 3.5*oni + 2.0*rain + rng.normal(0,3), 50, 130))
            cy = float(np.clip(2.5 - 0.08*oni + 0.05*rain + rng.normal(0,0.15), 0.5, 5.0))
            aloss = float(np.clip(5 + 4.0*oni - 2.0*rain + rng.normal(0,5), 0, 80))
            irrig = float(np.clip(60 - 8*oni + rng.normal(0,8), 10, 95))
            agri_rows.append(dict(year=year,region=region,crop_production_index=round(prod,1),
                crop_yield_tons_ha=round(cy,2),agricultural_loss_pct=round(aloss,1),irrigation_coverage_pct=round(irrig,1)))

            nutri = float(np.clip(20 + 15*br - 0.15*(prod-100) + 0.2*aloss + rng.normal(0,3), 5, 55))
            fsi = float(np.clip(75 - 12*br - 0.3*aloss + 0.2*prod + rng.normal(0,5), 20, 95))
            imr = float(np.clip(30 + 20*br + 0.05*aloss - 0.08*(prod-100) + rng.normal(0,4), 10, 80))
            stunt = float(np.clip(25 + 18*br - 0.1*(prod-100) + 0.15*aloss + rng.normal(0,3), 10, 60))
            health_rows.append(dict(year=year,region=region,malnutrition_pct=round(nutri,1),
                food_security_index=round(fsi,1),infant_mortality_rate=round(imr,1),stunting_pct=round(stunt,1)))

    climate = pd.DataFrame(climate_rows)
    agri = pd.DataFrame(agri_rows)
    health = pd.DataFrame(health_rows)
    merged = climate.merge(agri, on=["year","region"]).merge(health, on=["year","region"])

    risk = (15 + 8*merged["oni_value"].clip(lower=0) - 5*merged["rainfall_deviation"].clip(upper=0)
            + 3*merged["temperature_anomaly"].clip(lower=0) + 10*merged["drought_index"]
            - 0.15*(merged["crop_production_index"]-100).clip(upper=0)
            + 0.3*merged["agricultural_loss_pct"] + 0.25*merged["malnutrition_pct"]
            - 0.2*(merged["food_security_index"]-50).clip(upper=0)
            + 0.15*merged["infant_mortality_rate"]
            + rng.normal(0, 3, len(merged)))
    merged["risk_score"] = risk.clip(0, 100).round(1)

    climate.to_csv(DATA_DIR / "climate.csv", index=False)
    agri.to_csv(DATA_DIR / "agriculture.csv", index=False)
    health.to_csv(DATA_DIR / "health.csv", index=False)
    merged.to_csv(DATA_DIR / "full.csv", index=False)
    print(f"Data: {len(merged)} rows, risk {merged['risk_score'].min():.1f}-{merged['risk_score'].max():.1f}")
    return merged


# ── Model Training ───────────────────────────────────────────────

def train(df):
    le = LabelEncoder()
    df["region_enc"] = le.fit_transform(df["region"])
    feats = FEATURE_COLUMNS + ["region_enc", "year"]
    X, y = df[feats].values, df["risk_score"].values
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1,
                          subsample=0.8, colsample_bytree=0.8, random_state=42,
                          objective="reg:squarederror")
    model.fit(Xtr, ytr, eval_set=[(Xte, yte)], verbose=False)

    yp = model.predict(Xte)
    cv = cross_val_score(model, X, y, cv=5, scoring="r2")
    metrics = {
        "mae": round(float(mean_absolute_error(yte, yp)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(yte, yp))), 3),
        "r2": round(float(r2_score(yte, yp)), 3),
        "cv_r2_mean": round(float(cv.mean()), 3),
        "cv_r2_std": round(float(cv.std()), 3),
        "train_samples": len(Xtr), "test_samples": len(Xte),
    }
    fi = {feats[i]: round(float(model.feature_importances_[i]), 4)
          for i in range(len(feats))}
    fi = dict(sorted(fi.items(), key=lambda x: x[1], reverse=True))

    artifacts = {"model": model, "label_encoder": le, "feature_columns": feats,
                 "feature_importance": fi, "metrics": metrics,
                 "feature_descriptions": FEATURE_DESCRIPTIONS, "feature_groups": FEATURE_GROUPS,
                 "regions": REGIONS, "region_base_risk": REGION_BASE_RISK}

    with open(MODEL_DIR / "model.pkl", "wb") as f:
        pickle.dump(artifacts, f)
    with open(MODEL_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(MODEL_DIR / "meta.json", "w") as f:
        json.dump({"regions": REGIONS, "features": FEATURE_COLUMNS,
                    "descriptions": FEATURE_DESCRIPTIONS, "groups": FEATURE_GROUPS}, f, indent=2)

    print(f"Model: MAE={metrics['mae']}, R²={metrics['r2']}, CV R²={metrics['cv_r2_mean']}±{metrics['cv_r2_std']}")
    return artifacts


if __name__ == "__main__":
    df = generate_datasets()
    train(df)
    print("Artifacts saved to api/model/")
