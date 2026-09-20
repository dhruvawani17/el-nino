"""
El Nino Risk Intelligence - Vercel Serverless API
Model artifacts are loaded from /public/model/ via CDN.
"""
import json, os, pickle, urllib.request
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder

_model_dir = None
_artifacts = None
_dataset = None


def _get_model_dir():
    global _model_dir
    if _model_dir:
        return _model_dir
    # In Vercel, /public is served at the root URL
    # For local dev, read from filesystem
    local = Path(__file__).parent.parent / "public" / "model"
    if local.exists():
        _model_dir = local
        return _model_dir
    # Fallback: create tmp dir and download
    _model_dir = Path("/tmp/model")
    _model_dir.mkdir(exist_ok=True)
    base = os.environ.get("VERCEL_URL", "localhost:5173")
    proto = "https" if "vercel" in base else "http"
    for f in ["model.pkl", "full.csv", "meta.json", "metrics.json"]:
        url = f"{proto}://{base}/model/{f}"
        try:
            urllib.request.urlretrieve(url, _model_dir / f)
        except Exception:
            pass
    return _model_dir


def _load():
    global _artifacts, _dataset
    if _artifacts:
        return
    d = _get_model_dir()
    with open(d / "model.pkl", "rb") as f:
        _artifacts = pickle.load(f)
    _dataset = pd.read_csv(d / "full.csv")


RISK_CATS = [(25, "Low"), (45, "Moderate"), (65, "High"), (100, "Critical")]
FEAT_GROUPS = {
    "Climate": ["oni_value", "rainfall_deviation", "temperature_anomaly", "drought_index"],
    "Agriculture": ["crop_production_index", "crop_yield_tons_ha", "agricultural_loss_pct", "irrigation_coverage_pct"],
    "Health & Food Security": ["malnutrition_pct", "food_security_index", "infant_mortality_rate", "stunting_pct"],
}


def _risk_cat(s):
    for t, c in RISK_CATS:
        if s < t:
            return c
    return "Critical"


def _predict(inp):
    _load()
    model = _artifacts["model"]
    le = _artifacts["label_encoder"]
    fnames = _artifacts["feature_columns"]
    fimp = _artifacts["feature_importance"]
    region = inp["region"]
    year = inp.get("year", 2024)
    re = le.transform([region])[0] if region in le.classes_ else -1
    vec = []
    for fn in fnames:
        if fn == "region_enc":
            vec.append(re)
        elif fn == "year":
            vec.append(year)
        else:
            vec.append(inp.get(fn, 0))
    score = float(model.predict(np.array([vec]))[0])
    score = max(0.0, min(100.0, score))
    contribs = []
    for fn in fnames:
        if fn in ("region_enc", "year"):
            continue
        contribs.append({
            "feature": fn,
            "display_name": _artifacts["feature_descriptions"].get(fn, fn),
            "value": round(float(inp.get(fn, 0)), 3),
            "importance": round(float(fimp.get(fn, 0)), 4),
        })
    contribs.sort(key=lambda x: x["importance"], reverse=True)
    grouped = {}
    for g, gf in FEAT_GROUPS.items():
        items = [c for c in contribs if c["feature"] in gf]
        if items:
            grouped[g] = items
    return {
        "risk_score": round(score, 1),
        "risk_category": _risk_cat(score),
        "confidence": round(float(_artifacts["metrics"]["r2"]) * 100, 1),
        "contributions": contribs,
        "grouped_contributions": grouped,
    }


def _region_defaults(region):
    _load()
    rd = _dataset[_dataset["region"] == region]
    if len(rd) == 0:
        return None
    r = rd[rd["year"] == rd["year"].max()].iloc[0]
    return {
        "region": region, "year": int(r["year"]),
        "oni_value": round(float(r["oni_value"]), 2),
        "rainfall_deviation": round(float(r["rainfall_deviation"]), 3),
        "temperature_anomaly": round(float(r["temperature_anomaly"]), 3),
        "drought_index": round(float(r["drought_index"]), 3),
        "crop_production_index": round(float(r["crop_production_index"]), 1),
        "crop_yield_tons_ha": round(float(r["crop_yield_tons_ha"]), 2),
        "agricultural_loss_pct": round(float(r["agricultural_loss_pct"]), 1),
        "irrigation_coverage_pct": round(float(r["irrigation_coverage_pct"]), 1),
        "malnutrition_pct": round(float(r["malnutrition_pct"]), 1),
        "food_security_index": round(float(r["food_security_index"]), 1),
        "infant_mortality_rate": round(float(r["infant_mortality_rate"]), 1),
        "stunting_pct": round(float(r["stunting_pct"]), 1),
    }


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
        l = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(l)) if l else {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path.replace("/api", "")
        if path == "/regions":
            _load()
            profiles = {}
            for r in _artifacts["regions"]:
                d = _region_defaults(r)
                if d:
                    rd = _dataset[_dataset["region"] == r]
                    profiles[r] = {
                        "avg_risk_score": round(float(rd["risk_score"].mean()), 1),
                        "risk_category": _risk_cat(float(rd["risk_score"].mean())),
                        "data_years": int(rd["year"].nunique()),
                    }
            return self._send(200, {"regions": profiles, "total": len(profiles)})
        if path.startswith("/region/") and path.endswith("/history"):
            region = path.split("/")[2]
            _load()
            rd = _dataset[_dataset["region"] == region].sort_values("year")
            return self._send(200, {"region": region, "data": rd.to_dict(orient="records")})
        if path == "/features":
            _load()
            return self._send(200, {
                "features": _artifacts["feature_columns"],
                "descriptions": _artifacts["feature_descriptions"],
                "groups": FEAT_GROUPS,
            })
        if path == "/model/metrics":
            _load()
            return self._send(200, _artifacts["metrics"])
        if path == "/feature-importance":
            _load()
            fi = _artifacts["feature_importance"]
            desc = _artifacts["feature_descriptions"]
            items = [{"name": k, "importance": v, "display_name": desc.get(k, k)}
                     for k, v in fi.items() if k not in ("region_enc", "year")]
            items.sort(key=lambda x: x["importance"], reverse=True)
            return self._send(200, {"features": items, "metrics": _artifacts["metrics"]})
        if path == "/dataset/stats":
            _load()
            stats = {"total_records": len(_dataset), "regions": int(_dataset["region"].nunique()),
                     "year_range": [int(_dataset["year"].min()), int(_dataset["year"].max())]}
            return self._send(200, stats)
        return self._send(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path.replace("/api", "")
        body = self._json_body()
        if path == "/predict":
            return self._send(200, {"region": body["region"], "year": body.get("year", 2024), "prediction": _predict(body)})
        if path == "/scenario":
            base = body.get("base_input", {})
            mods = body.get("modifications", {})
            mod = {**base, **mods}
            br, mr = _predict(base), _predict(mod)
            delta = round(mr["risk_score"] - br["risk_score"], 1)
            return self._send(200, {
                "base_prediction": br, "modified_prediction": mr, "score_delta": delta,
                "delta_direction": "increased" if delta > 0 else "decreased" if delta < 0 else "unchanged",
                "changes": [{"feature": k, "old": base.get(k), "new": v} for k, v in mods.items()],
            })
        if path == "/compare":
            regions = body.get("regions", [])
            year = body.get("year", 2024)
            results = []
            for r in regions:
                d = _region_defaults(r)
                if not d:
                    continue
                d["year"] = year
                results.append({"region": r, "prediction": _predict(d), "input_data": d})
            results.sort(key=lambda x: x["prediction"]["risk_score"], reverse=True)
            return self._send(200, {
                "comparison": results,
                "ranking": [{"rank": i+1, "region": r["region"], "risk_score": r["prediction"]["risk_score"],
                             "risk_category": r["prediction"]["risk_category"]} for i, r in enumerate(results)],
            })
        if path == "/early-warning":
            threshold = body.get("threshold", 60)
            warnings = []
            for r in _artifacts["regions"]:
                d = _region_defaults(r)
                if not d:
                    continue
                pred = _predict(d)
                if pred["risk_score"] >= threshold:
                    warnings.append({"region": r, "risk_score": pred["risk_score"],
                                     "risk_category": pred["risk_category"],
                                     "top_factor": pred["contributions"][0] if pred["contributions"] else None})
            warnings.sort(key=lambda x: x["risk_score"], reverse=True)
            return self._send(200, {"threshold": threshold, "total_warnings": len(warnings), "warnings": warnings})
        return self._send(404, {"error": "Not found"})

    def log_message(self, fmt, *args):
        pass
