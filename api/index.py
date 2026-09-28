"""
El Nino Risk Intelligence - Vercel Serverless API
Model artifacts bundled in api/model/.
"""
import json, os, pickle, urllib.request
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

_artifacts = None
_dataset = None

MODEL_DIR = Path(__file__).parent / "model"


_thresholds_cache = None


def _load():
    global _artifacts, _dataset, _thresholds_cache
    if _artifacts:
        return
    with open(MODEL_DIR / "model.pkl", "rb") as f:
        _artifacts = pickle.load(f)
    _dataset = pd.read_csv(MODEL_DIR / "full.csv")
    _thresholds_cache = None


def _get_thresholds():
    global _thresholds_cache, _dataset
    if _thresholds_cache is not None:
        return _thresholds_cache
    _load()
    means = _dataset.groupby("region")["risk_score"].mean().round(1)
    r_low = float(means.quantile(0.333))
    r_high = float(means.quantile(0.667))
    scores = _dataset["risk_score"]
    s_low = float(scores.quantile(0.333))
    s_high = float(scores.quantile(0.667))
    _thresholds_cache = ((r_low, r_high), (s_low, s_high))
    return _thresholds_cache


def _region_risk_cat(avg_score):
    (r_low, r_high), _ = _get_thresholds()
    if avg_score <= r_low:
        return "Low"
    elif avg_score <= r_high:
        return "Moderate"
    else:
        return "High"


def _risk_cat(score):
    _, (s_low, s_high) = _get_thresholds()
    if score <= s_low:
        return "Low"
    elif score <= s_high:
        return "Moderate"
    elif score >= 50.0:
        return "Critical"
    else:
        return "High"


FEAT_GROUPS = {
    "Climate": ["oni_value", "rainfall_deviation", "temperature_anomaly", "drought_index"],
    "Agriculture": ["crop_production_index", "crop_yield_tons_ha", "agricultural_loss_pct", "irrigation_coverage_pct"],
    "Health & Food Security": ["malnutrition_pct", "food_security_index", "infant_mortality_rate", "stunting_pct"],
}


def _predict(inp):
    _load()
    model = _artifacts["model"]
    le = _artifacts["label_encoder"]
    fnames = _artifacts["feature_columns"]
    fimp = _artifacts["feature_importance"]
    region = inp.get("region", "")
    defaults = _region_defaults(region) or {}
    year = inp.get("year", defaults.get("year", 2026))
    re = le.transform([region])[0] if region in le.classes_ else -1
    vec = []
    for fn in fnames:
        if fn == "region_enc":
            vec.append(re)
        elif fn == "year":
            vec.append(year)
        else:
            vec.append(inp.get(fn, defaults.get(fn, 0)))
    score = float(model.predict(np.array([vec]))[0])
    score = max(0.0, min(100.0, score))
    contribs = []
    for fn in fnames:
        if fn in ("region_enc", "year"):
            continue
        val = inp.get(fn, defaults.get(fn, 0))
        contribs.append({
            "feature": fn,
            "display_name": _artifacts["feature_descriptions"].get(fn, fn),
            "value": round(float(val), 3),
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


def _build_3yr_projections(region):
    _load()
    base_2026 = _region_defaults(region)
    if not base_2026:
        return None

    rd = _dataset[_dataset["region"] == region]
    hist_rain_mean = float(rd["rainfall_deviation"].mean())
    hist_crop_mean = float(rd["crop_production_index"].mean())
    hist_loss_mean = float(rd["agricultural_loss_pct"].mean())
    hist_mal_mean = float(rd["malnutrition_pct"].mean())
    hist_imr_mean = float(rd["infant_mortality_rate"].mean())
    hist_sec_mean = float(rd["food_security_index"].mean())
    hist_stunt_mean = float(rd["stunting_pct"].mean())
    hist_yield_mean = float(rd["crop_yield_tons_ha"].mean())

    # 2027: Post-El Niño Transition / Decay
    p27 = dict(base_2026)
    p27["year"] = 2027
    p27["oni_value"] = -0.2
    p27["rainfall_deviation"] = round(base_2026["rainfall_deviation"] * 0.35 + hist_rain_mean * 0.65, 3)
    p27["temperature_anomaly"] = round(max(0.1, base_2026["temperature_anomaly"] * 0.35), 3)
    p27["drought_index"] = round(max(0.0, base_2026["drought_index"] * 0.4), 3)
    p27["crop_production_index"] = round(base_2026["crop_production_index"] * 0.4 + hist_crop_mean * 0.6, 1)
    p27["crop_yield_tons_ha"] = round(base_2026["crop_yield_tons_ha"] * 0.4 + hist_yield_mean * 0.6, 2)
    p27["agricultural_loss_pct"] = round(base_2026["agricultural_loss_pct"] * 0.45 + hist_loss_mean * 0.55, 1)
    p27["malnutrition_pct"] = round(base_2026["malnutrition_pct"] * 0.85 + hist_mal_mean * 0.15, 1)
    p27["infant_mortality_rate"] = round(base_2026["infant_mortality_rate"] * 0.88 + hist_imr_mean * 0.12, 1)
    p27["food_security_index"] = round(base_2026["food_security_index"] * 0.5 + hist_sec_mean * 0.5, 1)
    p27["stunting_pct"] = round(base_2026["stunting_pct"] * 0.92 + hist_stunt_mean * 0.08, 1)
    pred27 = _predict(p27)

    # 2028: La Niña Monsoon Surge
    p28 = dict(p27)
    p28["year"] = 2028
    p28["oni_value"] = -0.8
    p28["rainfall_deviation"] = round(max(0.06, hist_rain_mean + 0.12), 3)
    p28["temperature_anomaly"] = round(-0.05, 3)
    p28["drought_index"] = round(-0.25, 3)
    p28["crop_production_index"] = round(max(105.0, hist_crop_mean * 1.10), 1)
    p28["crop_yield_tons_ha"] = round(hist_yield_mean * 1.12, 2)
    p28["agricultural_loss_pct"] = round(min(6.5, hist_loss_mean * 0.6), 1)
    p28["malnutrition_pct"] = round(hist_mal_mean * 0.92, 1)
    p28["infant_mortality_rate"] = round(hist_imr_mean * 0.93, 1)
    p28["food_security_index"] = round(min(98.0, hist_sec_mean * 1.15), 1)
    p28["stunting_pct"] = round(hist_stunt_mean * 0.94, 1)
    pred28 = _predict(p28)

    # 2029: Baseline Stabilization / Neutral ENSO
    p29 = dict(p28)
    p29["year"] = 2029
    p29["oni_value"] = -0.1
    p29["rainfall_deviation"] = round(hist_rain_mean + 0.02, 3)
    p29["temperature_anomaly"] = round(0.15, 3)
    p29["drought_index"] = round(0.05, 3)
    p29["crop_production_index"] = round(hist_crop_mean * 1.03, 1)
    p29["crop_yield_tons_ha"] = round(hist_yield_mean * 1.04, 2)
    p29["agricultural_loss_pct"] = round(hist_loss_mean * 0.85, 1)
    p29["malnutrition_pct"] = round(hist_mal_mean * 0.88, 1)
    p29["infant_mortality_rate"] = round(hist_imr_mean * 0.89, 1)
    p29["food_security_index"] = round(hist_sec_mean * 1.08, 1)
    p29["stunting_pct"] = round(hist_stunt_mean * 0.91, 1)
    pred29 = _predict(p29)

    return {
        "base_2026": base_2026,
        "base_pred_2026": _predict(base_2026),
        "projections": [
            {"year": 2027, "phase": "Post-El Niño Decay / Transition", "input_data": p27, "prediction": pred27},
            {"year": 2028, "phase": "La Niña Monsoon Rebound", "input_data": p28, "prediction": pred28},
            {"year": 2029, "phase": "ENSO-Neutral Equilibrium", "input_data": p29, "prediction": pred29},
        ],
    }


def _fallback_llm_analysis(region, forecast_data):
    p26 = forecast_data["base_2026"]
    pred26 = forecast_data["base_pred_2026"]
    projs = forecast_data["projections"]
    p27, p28, p29 = projs[0], projs[1], projs[2]

    return {
        "llm_provider": "Aethera ML Intelligence Engine (Rule-based Fallback)",
        "executive_summary": (
            f"Over the next 3 years (2027–2029), {region} transitions from high climate vulnerability "
            f"(2026 risk score: {pred26['risk_score']}) toward strong agro-climatic stabilization "
            f"and public health recovery. The transition from El Niño decay in 2027 (risk: {p27['prediction']['risk_score']}) "
            f"to La Niña replenishment in 2028 (risk: {p28['prediction']['risk_score']}) drives a significant rebound "
            f"in crop yields and alleviates maternal-child nutrition stress, stabilizing fully by 2029 (risk: {p29['prediction']['risk_score']})."
        ),
        "rainfall_outlook": (
            f"Rainfall patterns in {region} exhibit a sharp cyclical reversal. After the 2026 deficit "
            f"({p26['rainfall_deviation']*100:+.1f}%), 2027 experiences an easing anomaly "
            f"({p27['input_data']['rainfall_deviation']*100:+.1f}%) as Pacific SST anomalies normalize. "
            f"In 2028, La Niña conditions trigger enhanced monsoon precipitation ({p28['input_data']['rainfall_deviation']*100:+.1f}%), "
            f"recharging regional reservoirs and groundwater tables. By 2029, precipitation patterns normalize to steady baseline ({p29['input_data']['rainfall_deviation']*100:+.1f}%)."
        ),
        "crop_outlook": (
            f"Agricultural productivity follows a robust V-shaped recovery curve. Crop production index rebounds from "
            f"{p26['crop_production_index']:.1f} in 2026 to {p27['input_data']['crop_production_index']:.1f} in 2027, "
            f"surpassing baseline to {p28['input_data']['crop_production_index']:.1f} in 2028 as soil moisture recovers. "
            f"Agricultural losses decline from {p26['agricultural_loss_pct']:.1f}% down to {p28['input_data']['agricultural_loss_pct']:.1f}%, "
            f"with staple crop yields rising from {p26['crop_yield_tons_ha']:.2f} t/ha to {p28['input_data']['crop_yield_tons_ha']:.2f} t/ha."
        ),
        "child_health_mortality_outlook": (
            f"Public health indicators demonstrate positive lag dynamics. While acute food insecurity subsides in 2027, "
            f"child malnutrition gradually declines from {p26['malnutrition_pct']:.1f}% to {p27['input_data']['malnutrition_pct']:.1f}% in 2027, "
            f"and drops further to {p28['input_data']['malnutrition_pct']:.1f}% by 2028. Infant Mortality Rate (IMR) follows a steady downward trajectory "
            f"from {p26['infant_mortality_rate']:.1f} to {p28['input_data']['infant_mortality_rate']:.1f} per 1,000 live births, "
            f"benefiting from improved caloric availability, clean drinking water access, and restored maternal nutrition."
        ),
        "yearly_breakdown": {
            "2027": {
                "phase": p27["phase"],
                "rainfall_summary": f"Deficit narrows to {p27['input_data']['rainfall_deviation']*100:+.1f}%; early pre-monsoon showers stabilize soil moisture.",
                "crop_summary": f"Production index reaches {p27['input_data']['crop_production_index']:.1f}; agricultural losses moderate to {p27['input_data']['agricultural_loss_pct']:.1f}%.",
                "child_health_summary": f"IMR eases to {p27['input_data']['infant_mortality_rate']:.1f}; malnutrition decreases to {p27['input_data']['malnutrition_pct']:.1f}%.",
                "priority_action": "Subsidize drought-hardy seed varieties, replenish rural grain buffers, and maintain supplementary child nutrition feeding.",
            },
            "2028": {
                "phase": p28["phase"],
                "rainfall_summary": f"Surplus monsoon rainfall ({p28['input_data']['rainfall_deviation']*100:+.1f}%) restores reservoirs and groundwater aquifers.",
                "crop_summary": f"Bumper harvest with production index hitting {p28['input_data']['crop_production_index']:.1f} and yield at {p28['input_data']['crop_yield_tons_ha']:.2f} t/ha.",
                "child_health_summary": f"Sharp reduction in malnutrition ({p28['input_data']['malnutrition_pct']:.1f}%) and IMR dropping to {p28['input_data']['infant_mortality_rate']:.1f}.",
                "priority_action": "Deploy flood drainage protocols, expand cold storage, and scale deworming and immunization drives during monsoon months.",
            },
            "2029": {
                "phase": p29["phase"],
                "rainfall_summary": f"Monsoon returns to equilibrium baseline ({p29['input_data']['rainfall_deviation']*100:+.1f}% deviation).",
                "crop_summary": f"Sustainable crop yields ({p29['input_data']['crop_yield_tons_ha']:.2f} t/ha) and minimal structural losses ({p29['input_data']['agricultural_loss_pct']:.1f}%).",
                "child_health_summary": f"IMR reaches optimal multi-year low of {p29['input_data']['infant_mortality_rate']:.1f} with stunting falling to {p29['input_data']['stunting_pct']:.1f}%.",
                "priority_action": "Institutionalize climate-smart micro-irrigation and universalize digital growth-monitoring in Anganwadi centers.",
            },
        },
        "policy_recommendations": [
            {"sector": "Agriculture & Irrigation", "action": "Scale precision drip irrigation coverage and micro-check dams to lock in 2028 La Niña rainfall gains."},
            {"sector": "Maternal & Child Health", "action": "Expand fortified cereal and pulse rations in PDS to overcome 2026-induced stunting lags."},
            {"sector": "Water & Disaster Management", "action": "Implement watershed rejuvenation and village percolation ponds ahead of the 2028 high-rainfall window."},
        ],
    }


def _call_groq_llm(region, forecast_data):
    api_key = os.environ.get("GROQ_API_KEY", GROQ_API_KEY)
    if not api_key:
        return _fallback_llm_analysis(region, forecast_data)

    p26 = forecast_data["base_2026"]
    pred26 = forecast_data["base_pred_2026"]
    projs = forecast_data["projections"]
    p27, p28, p29 = projs[0], projs[1], projs[2]

    prompt = f"""
You are an expert agro-meteorologist and public health epidemiologist analyzing the 3-Year Post-El Niño projection (2027, 2028, 2029) for the Indian state of {region}.

ML Model Projections:
- 2026 (Baseline El Niño Event): Risk Score {pred26['risk_score']} ({pred26['risk_category']}), Rainfall Dev {p26['rainfall_deviation']*100:+.1f}%, Crop Production Index {p26['crop_production_index']}, Ag Loss {p26['agricultural_loss_pct']}%, Malnutrition {p26['malnutrition_pct']}%, Infant Mortality Rate (IMR) {p26['infant_mortality_rate']}/1000.
- 2027 ({p27['phase']}, ONI {p27['input_data']['oni_value']}): Projected Risk Score {p27['prediction']['risk_score']} ({p27['prediction']['risk_category']}), Rainfall Dev {p27['input_data']['rainfall_deviation']*100:+.1f}%, Crop Production Index {p27['input_data']['crop_production_index']}, Ag Loss {p27['input_data']['agricultural_loss_pct']}%, Malnutrition {p27['input_data']['malnutrition_pct']}%, IMR {p27['input_data']['infant_mortality_rate']}/1000.
- 2028 ({p28['phase']}, ONI {p28['input_data']['oni_value']}): Projected Risk Score {p28['prediction']['risk_score']} ({p28['prediction']['risk_category']}), Rainfall Dev {p28['input_data']['rainfall_deviation']*100:+.1f}%, Crop Production Index {p28['input_data']['crop_production_index']}, Ag Loss {p28['input_data']['agricultural_loss_pct']}%, Malnutrition {p28['input_data']['malnutrition_pct']}%, IMR {p28['input_data']['infant_mortality_rate']}/1000.
- 2029 ({p29['phase']}, ONI {p29['input_data']['oni_value']}): Projected Risk Score {p29['prediction']['risk_score']} ({p29['prediction']['risk_category']}), Rainfall Dev {p29['input_data']['rainfall_deviation']*100:+.1f}%, Crop Production Index {p29['input_data']['crop_production_index']}, Ag Loss {p29['input_data']['agricultural_loss_pct']}%, Malnutrition {p29['input_data']['malnutrition_pct']}%, IMR {p29['input_data']['infant_mortality_rate']}/1000.

Return a comprehensive, well-structured JSON with the following exact keys:
{{
  "executive_summary": "Concise high-level overview of the 3-year multi-sector recovery trajectory for {region}.",
  "rainfall_outlook": "Deep-dive analysis of monsoon and rainfall dynamics across 2027, 2028, and 2029.",
  "crop_outlook": "Detailed analysis of agricultural yields, kharif/rabi production, and economic losses across the 3 years.",
  "child_health_mortality_outlook": "Specific analysis of child malnutrition, stunting lags, dietary diversity, and Infant Mortality Rate (IMR) progression.",
  "yearly_breakdown": {{
    "2027": {{"phase": "{p27['phase']}", "rainfall_summary": "...", "crop_summary": "...", "child_health_summary": "...", "priority_action": "..."}},
    "2028": {{"phase": "{p28['phase']}", "rainfall_summary": "...", "crop_summary": "...", "child_health_summary": "...", "priority_action": "..."}},
    "2029": {{"phase": "{p29['phase']}", "rainfall_summary": "...", "crop_summary": "...", "child_health_summary": "...", "priority_action": "..."}}
  }},
  "policy_recommendations": [
    {{"sector": "Agriculture & Irrigation", "action": "..."}},
    {{"sector": "Maternal & Child Health", "action": "..."}},
    {{"sector": "Water & Disaster Management", "action": "..."}}
  ]
}}
"""

    models_to_try = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
    for model_name in models_to_try:
        try:
            req_data = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are a professional climate, agricultural, and public health analyst. Always respond in valid, parseable JSON format only."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3
            }
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=json.dumps(req_data).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0"
                }
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                content = res["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                parsed["llm_provider"] = f"Groq ({model_name})"
                return parsed
        except Exception:
            continue

    return _fallback_llm_analysis(region, forecast_data)


def _generate_3yr_forecast(region):
    _load()
    if region not in _artifacts["regions"]:
        matches = [r for r in _artifacts["regions"] if r.lower() == region.lower()]
        if matches:
            region = matches[0]
        else:
            return None

    forecast_data = _build_3yr_projections(region)
    if not forecast_data:
        return None

    llm_result = _call_groq_llm(region, forecast_data)

    return {
        "region": region,
        "base_year": 2026,
        "forecast_years": [2027, 2028, 2029],
        "base_2026": {
            "prediction": forecast_data["base_pred_2026"],
            "metrics": forecast_data["base_2026"],
        },
        "yearly_projections": [
            {
                "year": p["year"],
                "phase": p["phase"],
                "risk_score": p["prediction"]["risk_score"],
                "risk_category": p["prediction"]["risk_category"],
                "metrics": p["input_data"],
                "contributions": p["prediction"]["contributions"][:4],
            }
            for p in forecast_data["projections"]
        ],
        "llm_analysis": llm_result,
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
        parsed_url = urlparse(self.path)
        path = parsed_url.path.replace("/api", "")
        if path == "/regions":
            _load()
            profiles = {}
            for r in _artifacts["regions"]:
                d = _region_defaults(r)
                if d:
                    rd = _dataset[_dataset["region"] == r]
                    avg_score = round(float(rd["risk_score"].mean()), 1)
                    profiles[r] = {
                        "avg_risk_score": avg_score,
                        "risk_category": _region_risk_cat(avg_score),
                        "data_years": int(rd["year"].nunique()),
                    }
            return self._send(200, {"regions": profiles, "total": len(profiles)})
        if path.startswith("/region/") and path.endswith("/history"):
            region = unquote(path.split("/")[2])
            _load()
            rd = _dataset[_dataset["region"] == region].sort_values("year")
            return self._send(200, {"region": region, "data": rd.to_dict(orient="records")})
        if path.startswith("/region/") and path.endswith("/forecast-3yr"):
            region = unquote(path.split("/")[2])
            data = _generate_3yr_forecast(region)
            if not data:
                return self._send(404, {"error": f"Region {region} not found"})
            return self._send(200, data)
        if path == "/forecast-3yr":
            from urllib.parse import parse_qs
            qs = parse_qs(parsed_url.query)
            region = qs.get("region", ["Bihar"])[0]
            data = _generate_3yr_forecast(region)
            if not data:
                return self._send(404, {"error": f"Region {region} not found"})
            return self._send(200, data)
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
            return self._send(200, {"region": body["region"], "year": body.get("year", 2026), "prediction": _predict(body)})
        if path == "/forecast-3yr":
            region = body.get("region", "Bihar")
            data = _generate_3yr_forecast(region)
            if not data:
                return self._send(404, {"error": f"Region {region} not found"})
            return self._send(200, data)
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
            year = body.get("year", 2026)
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
            threshold = body.get("threshold", 33)
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
