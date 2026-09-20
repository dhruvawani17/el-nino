"""
El Niño Risk Intelligence — Vercel Serverless API

Single handler serving all endpoints. Vercel routes /api/* to this function.
"""

import json
import os
import pickle
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder

# ── Artifact loading (cold start) ─────────────────────────────────

_MODEL_DIR = Path(__file__).parent / "model"
_DATA_DIR = Path(__file__).parent / "data"

_artifacts = None
_dataset = None


def _load():
    global _artifacts, _dataset
    if _artifacts is not None:
        return
    with open(_MODEL_DIR / "model.pkl", "rb") as f:
        _artifacts = pickle.load(f)
    _dataset = pd.read_csv(_DATA_DIR / "full.csv")


# ── Prediction helpers ────────────────────────────────────────────

RISK_CATEGORIES = [(25, "Low"), (45, "Moderate"), (65, "High"), (100, "Critical")]

FEATURE_GROUPS = {
    "Climate": ["oni_value", "rainfall_deviation", "temperature_anomaly", "drought_index"],
    "Agriculture": ["crop_production_index", "crop_yield_tons_ha", "agricultural_loss_pct", "irrigation_coverage_pct"],
    "Health & Food Security": ["malnutrition_pct", "food_security_index", "infant_mortality_rate", "stunting_pct"],
}


def _risk_category(score):
    for threshold, cat in RISK_CATEGORIES:
        if score < threshold:
            return cat
    return "Critical"


def _predict(input_data: dict) -> dict:
    _load()
    model: XGBRegressor = _artifacts["model"]
    le: LabelEncoder = _artifacts["label_encoder"]
    feat_names = _artifacts["feature_columns"]
    feat_imp = _artifacts["feature_importance"]

    region = input_data["region"]
    year = input_data.get("year", 2024)
    region_enc = le.transform([region])[0] if region in le.classes_ else -1

    vec = []
    for fn in feat_names:
        if fn == "region_enc":
            vec.append(region_enc)
        elif fn == "year":
            vec.append(year)
        else:
            vec.append(input_data.get(fn, 0))

    X = np.array([vec])
    score = float(model.predict(X)[0])
    score = max(0.0, min(100.0, score))

    contributions = []
    for fn in feat_names:
        if fn in ("region_enc", "year"):
            continue
        contributions.append({
            "feature": fn,
            "display_name": _artifacts["feature_descriptions"].get(fn, fn),
            "value": round(float(input_data.get(fn, 0)), 3),
            "importance": round(float(feat_imp.get(fn, 0)), 4),
        })
    contributions.sort(key=lambda x: x["importance"], reverse=True)

    grouped = {}
    for gname, gfeats in FEATURE_GROUPS.items():
        items = [c for c in contributions if c["feature"] in gfeats]
        if items:
            grouped[gname] = items

    return {
        "risk_score": round(score, 1),
        "risk_category": _risk_category(score),
        "confidence": round(float(_artifacts["metrics"]["r2"]) * 100, 1),
        "contributions": contributions,
        "grouped_contributions": grouped,
    }


def _get_region_defaults(region: str) -> dict:
    """Get latest year data for a region."""
    _load()
    rd = _dataset[_dataset["region"] == region]
    if len(rd) == 0:
        return None
    latest = rd[rd["year"] == rd["year"].max()].iloc[0]
    return {
        "region": region, "year": int(latest["year"]),
        "oni_value": round(float(latest["oni_value"]), 2),
        "rainfall_deviation": round(float(latest["rainfall_deviation"]), 3),
        "temperature_anomaly": round(float(latest["temperature_anomaly"]), 3),
        "drought_index": round(float(latest["drought_index"]), 3),
        "crop_production_index": round(float(latest["crop_production_index"]), 1),
        "crop_yield_tons_ha": round(float(latest["crop_yield_tons_ha"]), 2),
        "agricultural_loss_pct": round(float(latest["agricultural_loss_pct"]), 1),
        "irrigation_coverage_pct": round(float(latest["irrigation_coverage_pct"]), 1),
        "malnutrition_pct": round(float(latest["malnutrition_pct"]), 1),
        "food_security_index": round(float(latest["food_security_index"]), 1),
        "infant_mortality_rate": round(float(latest["infant_mortality_rate"]), 1),
        "stunting_pct": round(float(latest["stunting_pct"]), 1),
    }


def _history(region: str) -> list:
    _load()
    rd = _dataset[_dataset["region"] == region].sort_values("year")
    return rd.to_dict(orient="records")


# ── Vercel Handler ────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ct="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ct)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode() if isinstance(body, (dict, list)) else body.encode())

    def _json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.replace("/api", "")
        qs = parse_qs(parsed.query)

        if path == "/regions":
            _load()
            profiles = {}
            for region in _artifacts["regions"]:
                d = _get_region_defaults(region)
                if d:
                    rd = _dataset[_dataset["region"] == region]
                    profiles[region] = {
                        "avg_risk_score": round(float(rd["risk_score"].mean()), 1),
                        "risk_category": _risk_category(float(rd["risk_score"].mean())),
                        "data_years": int(rd["year"].nunique()),
                    }
            return self._send(200, {"regions": profiles, "total": len(profiles)})

        if path.startswith("/region/") and path.endswith("/history"):
            region = path.split("/")[2]
            return self._send(200, {"region": region, "data": _history(region)})

        if path == "/features":
            _load()
            return self._send(200, {
                "features": _artifacts["feature_columns"],
                "descriptions": _artifacts["feature_descriptions"],
                "groups": FEATURE_GROUPS,
            })

        if path == "/model/metrics":
            _load()
            return self._send(200, _artifacts["metrics"])

        if path == "/dataset/stats":
            _load()
            stats = {"total_records": len(_dataset), "regions": int(_dataset["region"].nunique()),
                     "year_range": [int(_dataset["year"].min()), int(_dataset["year"].max())],
                     "feature_stats": {}}
            for col in list(_artifacts["feature_descriptions"].keys()) + ["risk_score"]:
                if col in _dataset.columns:
                    stats["feature_stats"][col] = {
                        "mean": round(float(_dataset[col].mean()), 3),
                        "std": round(float(_dataset[col].std()), 3),
                        "min": round(float(_dataset[col].min()), 3),
                        "max": round(float(_dataset[col].max()), 3),
                    }
            return self._send(200, stats)

        if path == "/feature-importance":
            _load()
            fi = _artifacts["feature_importance"]
            desc = _artifacts["feature_descriptions"]
            items = [{"name": k, "importance": v, "display_name": desc.get(k, k)}
                     for k, v in fi.items() if k not in ("region_enc", "year")]
            items.sort(key=lambda x: x["importance"], reverse=True)
            return self._send(200, {"features": items, "metrics": _artifacts["metrics"]})

        return self._send(404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.replace("/api", "")
        body = self._json_body()

        if path == "/predict":
            result = _predict(body)
            return self._send(200, {"region": body["region"], "year": body.get("year", 2024), "prediction": result})

        if path == "/scenario":
            base = body.get("base_input", {})
            mods = body.get("modifications", {})
            modified = {**base, **mods}
            base_r = _predict(base)
            mod_r = _predict(modified)
            delta = round(mod_r["risk_score"] - base_r["risk_score"], 1)
            return self._send(200, {
                "base_prediction": base_r, "modified_prediction": mod_r,
                "score_delta": delta,
                "delta_direction": "increased" if delta > 0 else "decreased" if delta < 0 else "unchanged",
                "changes": [{"feature": k, "old": base.get(k), "new": v} for k, v in mods.items()],
            })

        if path == "/compare":
            regions = body.get("regions", [])
            year = body.get("year", 2024)
            results = []
            for r in regions:
                d = _get_region_defaults(r)
                if not d:
                    continue
                d["year"] = year
                pred = _predict(d)
                results.append({"region": r, "prediction": pred, "input_data": d})
            results.sort(key=lambda x: x["prediction"]["risk_score"], reverse=True)
            return self._send(200, {
                "comparison": results,
                "ranking": [{"rank": i+1, "region": r["region"], "risk_score": r["prediction"]["risk_score"],
                             "risk_category": r["prediction"]["risk_category"]} for i, r in enumerate(results)],
            })

        if path == "/early-warning":
            threshold = body.get("threshold", 60)
            year = body.get("year", 2024)
            warnings = []
            for r in _artifacts["regions"]:
                d = _get_region_defaults(r)
                if not d:
                    continue
                d["year"] = year
                pred = _predict(d)
                if pred["risk_score"] >= threshold:
                    warnings.append({"region": r, "risk_score": pred["risk_score"],
                                     "risk_category": pred["risk_category"],
                                     "top_factor": pred["contributions"][0] if pred["contributions"] else None})
            warnings.sort(key=lambda x: x["risk_score"], reverse=True)
            return self._send(200, {"threshold": threshold, "total_warnings": len(warnings),
                                     "warnings": warnings})

        return self._send(404, {"error": "Not found"})

    def log_message(self, fmt, *args):
        pass  # Silence logs in serverless
