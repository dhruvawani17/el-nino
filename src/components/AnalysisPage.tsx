import { useState, useEffect } from 'react';
import { getRegions, predict, getRegionHistory } from '../api';
import RiskGauge from './charts/RiskGauge';
import RadarChart from './charts/RadarChart';
import AnimatedNumber from './charts/AnimatedNumber';
import DecisionProcess from './DecisionProcess';

interface RegionProfile {
  avg_risk_score: number;
  risk_category: string;
  data_years: number;
}

interface PredictionResult {
  risk_score: number;
  risk_category: string;
  confidence: number;
  contributions: { feature: string; display_name: string; value: number; importance: number }[];
  grouped_contributions: Record<string, { feature: string; display_name: string; value: number; importance: number }[]>;
}

interface HistoryEntry {
  year: number;
  oni_value: number;
  rainfall_deviation: number;
  crop_production_index: number;
  risk_score: number;
}

const INPUT_FIELDS = [
  { key: 'oni_value', label: 'ONI Value', step: 0.1, min: -3, max: 3, desc: 'El Nino / ONI Index' },
  { key: 'rainfall_deviation', label: 'Rainfall Deviation', step: 0.05, min: -2, max: 2, desc: 'Deviation from normal' },
  { key: 'temperature_anomaly', label: 'Temp Anomaly', step: 0.05, min: -1, max: 2, desc: 'Temperature deviation' },
  { key: 'drought_index', label: 'Drought Index', step: 0.05, min: 0, max: 1, desc: 'Severity (0-1)' },
  { key: 'crop_production_index', label: 'Crop Production', step: 1, min: 50, max: 130, desc: '100 = baseline' },
  { key: 'crop_yield_tons_ha', label: 'Crop Yield', step: 0.1, min: 0.5, max: 5, desc: 'Tons/hectare' },
  { key: 'agricultural_loss_pct', label: 'Ag. Loss %', step: 1, min: 0, max: 80, desc: 'Percentage loss' },
  { key: 'irrigation_coverage_pct', label: 'Irrigation %', step: 1, min: 10, max: 95, desc: 'Coverage area' },
  { key: 'malnutrition_pct', label: 'Malnutrition %', step: 1, min: 5, max: 55, desc: 'Child prevalence' },
  { key: 'food_security_index', label: 'Food Security', step: 1, min: 20, max: 95, desc: '0-100 index' },
  { key: 'infant_mortality_rate', label: 'Infant Mortality', step: 1, min: 10, max: 80, desc: 'Per 1000 births' },
  { key: 'stunting_pct', label: 'Stunting %', step: 1, min: 10, max: 60, desc: 'Under age 5' },
];

export default function AnalysisPage() {
  const [regions, setRegions] = useState<Record<string, RegionProfile>>({});
  const [region, setRegion] = useState('');
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDecision, setShowDecision] = useState(false);

  useEffect(() => {
    getRegions().then((d) => setRegions(d.regions)).catch(() => {});
  }, []);

  const loadRegion = async (r: string) => {
    setRegion(r);
    setLoading(true);
    setError('');
    try {
      const hist = await getRegionHistory(r);
      const latest = hist.data[hist.data.length - 1];
      setHistory(hist.data);
      setInputs({
        oni_value: latest.oni_value,
        rainfall_deviation: latest.rainfall_deviation,
        temperature_anomaly: latest.temperature_anomaly,
        drought_index: latest.drought_index,
        crop_production_index: latest.crop_production_index,
        crop_yield_tons_ha: latest.crop_yield_tons_ha,
        agricultural_loss_pct: latest.agricultural_loss_pct,
        irrigation_coverage_pct: latest.irrigation_coverage_pct,
        malnutrition_pct: latest.malnutrition_pct,
        food_security_index: latest.food_security_index,
        infant_mortality_rate: latest.infant_mortality_rate,
        stunting_pct: latest.stunting_pct,
      });
    } catch {
      setError('Failed to load region data');
    }
    setLoading(false);
  };

  const runAnalysis = async () => {
    if (!region) return;
    setLoading(true);
    setError('');
    try {
      const data = await predict({ region, year: 2024, ...inputs });
      setResult(data.prediction);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Prediction failed');
    }
    setLoading(false);
  };

  const updateInput = (key: string, val: number) => setInputs((p) => ({ ...p, [key]: val }));

  const riskColor = (cat: string) => {
    if (cat === 'Critical') return 'text-red-600 bg-red-50';
    if (cat === 'High') return 'text-orange-600 bg-orange-50';
    if (cat === 'Moderate') return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  const radarData = result ? [
    { label: 'Climate', value: ((inputs.oni_value || 0) + 3) / 6 * 100 },
    { label: 'Drought', value: (inputs.drought_index || 0) * 100 },
    { label: 'Crops', value: Math.max(0, 130 - (inputs.crop_production_index || 100)) / 80 * 100 },
    { label: 'Losses', value: (inputs.agricultural_loss_pct || 0) / 80 * 100 },
    { label: 'Nutrition', value: (inputs.malnutrition_pct || 0) / 55 * 100 },
    { label: 'Food Sec', value: 100 - ((inputs.food_security_index || 70) / 95 * 100) },
    { label: 'Mortality', value: (inputs.infant_mortality_rate || 0) / 80 * 100 },
    { label: 'Stunting', value: (inputs.stunting_pct || 0) / 60 * 100 },
  ] : [];

  const interFont = "'Inter', sans-serif";
  const serifFont = "'Instrument Serif', serif";

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen">
      <DecisionProcess isOpen={showDecision} onClose={() => setShowDecision(false)} inputs={inputs} prediction={result || undefined} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <span className="text-xs font-medium tracking-widest uppercase text-[#6F6F6F] mb-3 block" style={{ fontFamily: interFont }}>
              Regional Risk Analysis
            </span>
            <h1 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-1.5px] text-[#000000]" style={{ fontFamily: serifFont }}>
              Analyze regional <span className="text-[#6F6F6F] italic">risk intelligence</span>
            </h1>
            <p className="text-base text-[#6F6F6F] mt-3 max-w-xl" style={{ fontFamily: interFont }}>
              Select a region, adjust indicators, and run the ML prediction engine.
            </p>
          </div>
          <button onClick={() => setShowDecision(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#E8E8E8] bg-white hover:bg-[#F5F5F5] transition-all cursor-pointer group shrink-0 mt-8"
            style={{ fontFamily: interFont }}>
            <svg className="w-4 h-4 text-[#6F6F6F] group-hover:text-[#000] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="text-sm text-[#6F6F6F] group-hover:text-[#000] transition-colors">Show Decision Process</span>
          </button>
        </div>

        {/* Main Grid - Top Row */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Region Selector */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-medium text-[#6F6F6F] mb-3 uppercase tracking-wider" style={{ fontFamily: interFont }}>Regions</h3>
            <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
              {Object.entries(regions).map(([name, profile]) => (
                <button key={name} onClick={() => loadRegion(name)}
                  className={"w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all cursor-pointer " + (region === name ? "bg-[#000] text-white" : "hover:bg-[#F5F5F5] text-[#6F6F6F]")}
                  style={{ fontFamily: interFont }}>
                  <div className="flex items-center justify-between">
                    <span>{name}</span>
                    <span className={"text-[10px] px-1.5 py-0.5 rounded-full " + (region === name ? "bg-white/20 text-white" : riskColor(profile.risk_category))}>
                      {profile.risk_category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Inputs */}
          <div className="lg:col-span-4">
            <h3 className="text-xs font-medium text-[#6F6F6F] mb-3 uppercase tracking-wider" style={{ fontFamily: interFont }}>Indicators</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {INPUT_FIELDS.map((field) => (
                <div key={field.key} className="bg-[#FAFAFA] rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[11px] font-medium text-[#000000]" style={{ fontFamily: interFont }}>{field.label}</label>
                    <input type="number" value={inputs[field.key] ?? 0} step={field.step}
                      onChange={(e) => updateInput(field.key, parseFloat(e.target.value) || 0)}
                      className="w-16 text-right text-[11px] bg-white border border-[#E8E8E8] rounded-md px-1.5 py-0.5 focus:outline-none focus:border-[#000000]"
                      style={{ fontFamily: interFont }} />
                  </div>
                  <input type="range" min={field.min} max={field.max} step={field.step} value={inputs[field.key] ?? 0}
                    onChange={(e) => updateInput(field.key, parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#E0E0E0] rounded-full appearance-none cursor-pointer accent-[#000000]" />
                  <div className="flex justify-between text-[9px] text-[#6F6F6F] mt-0.5" style={{ fontFamily: interFont }}>
                    <span>{field.min}</span><span>{field.desc}</span><span>{field.max}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={runAnalysis} disabled={!region || loading}
              className="w-full mt-3 py-2.5 rounded-xl bg-[#000000] text-white text-sm font-medium transition-all hover:scale-[1.01] disabled:opacity-40 cursor-pointer"
              style={{ fontFamily: interFont }}>
              {loading ? 'Running...' : 'Run Risk Prediction'}
            </button>
            {error && <p className="text-xs text-red-500 mt-2" style={{ fontFamily: interFont }}>{error}</p>}
          </div>

          {/* Gauge + Radar */}
          <div className="lg:col-span-3 flex flex-col items-center gap-4">
            <RiskGauge value={result?.risk_score ?? 0} size={200} label="Risk Score" />
            {result && (
              <div className="bg-[#FAFAFA] rounded-2xl p-4 w-full">
                <h4 className="text-xs font-medium text-[#000] mb-2 text-center" style={{ fontFamily: interFont }}>Risk Radar</h4>
                <RadarChart data={radarData} size={200} />
              </div>
            )}
            {!result && (
              <div className="bg-[#FAFAFA] rounded-2xl p-6 w-full flex flex-col items-center justify-center min-h-[220px]">
                <svg className="w-10 h-10 text-[#D0D0D0] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
                <p className="text-xs text-[#6F6F6F] text-center" style={{ fontFamily: interFont }}>Run analysis to visualize risk</p>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {result ? (
              <div className="space-y-3">
                <div className="bg-[#000000] rounded-2xl p-5 text-white">
                  <span className="text-[10px] text-white/50 block mb-1" style={{ fontFamily: interFont }}>Predicted Risk</span>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-normal" style={{ fontFamily: serifFont }}>
                      <AnimatedNumber value={result.risk_score} decimals={1} />
                    </span>
                    <span className="text-sm text-white/40 mb-1">/100</span>
                  </div>
                  <span className={"text-xs px-2 py-0.5 rounded-full mt-2 inline-block " + riskColor(result.risk_category)}>
                    {result.risk_category} Risk
                  </span>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-white/50 mb-1" style={{ fontFamily: interFont }}>
                      <span>Confidence</span><span>{result.confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/60 rounded-full" style={{ width: result.confidence + '%' }} />
                    </div>
                  </div>
                </div>

                <div className="bg-[#FAFAFA] rounded-2xl p-4">
                  <h4 className="text-[11px] font-medium text-[#000] mb-3" style={{ fontFamily: interFont }}>Top Factors</h4>
                  <div className="space-y-2">
                    {result.contributions.slice(0, 6).map((c) => (
                      <div key={c.feature}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-[#6F6F6F]" style={{ fontFamily: interFont }}>{c.display_name}</span>
                          <span className="text-[10px] font-medium text-[#000]" style={{ fontFamily: interFont }}>{c.value}</span>
                        </div>
                        <div className="h-1 bg-[#E8E8E8] rounded-full overflow-hidden">
                          <div className="h-full bg-[#000] rounded-full" style={{ width: Math.min(100, c.importance * 150) + '%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FAFAFA] rounded-2xl p-4">
                  <h4 className="text-[11px] font-medium text-[#000] mb-3" style={{ fontFamily: interFont }}>Domain Breakdown</h4>
                  {Object.entries(result.grouped_contributions).map(([group, items]) => (
                    <div key={group} className="mb-2 last:mb-0">
                      <span className="text-[10px] font-medium text-[#6F6F6F] block mb-1" style={{ fontFamily: interFont }}>{group}</span>
                      <div className="flex flex-wrap gap-1">
                        {items.map((item) => (
                          <span key={item.feature} className="px-2 py-0.5 rounded text-[10px] bg-white border border-[#E8E8E8] text-[#000]"
                            style={{ fontFamily: interFont }}>
                            {item.display_name}: {item.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-[#FAFAFA] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
                <svg className="w-12 h-12 text-[#D0D0D0] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <p className="text-sm text-[#6F6F6F]" style={{ fontFamily: interFont }}>
                  Select a region and run analysis to see predictions
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Historical Chart */}
        {history.length > 0 && (() => {
          const W = 900, H = 280, PAD = { top: 20, right: 20, bottom: 40, left: 40 };
          const cW = W - PAD.left - PAD.right;
          const cH = H - PAD.top - PAD.bottom;
          const maxRisk = 80;
          const xStep = cW / (history.length - 1);
          const points = history.map((h, i) => ({
            x: PAD.left + i * xStep,
            y: PAD.top + cH - (Math.min(h.risk_score, maxRisk) / maxRisk) * cH,
            score: h.risk_score,
            year: h.year,
          }));

          const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
          const areaPath = linePath + ' L' + points[points.length - 1].x + ',' + (PAD.top + cH) + ' L' + points[0].x + ',' + (PAD.top + cH) + ' Z';

          const gridLines = [0, 20, 40, 60, 80].map((v) => ({
            y: PAD.top + cH - (v / maxRisk) * cH,
            label: v,
          }));

          const getCatColor = (score: number) => {
            if (score < 25) return '#4ade80';
            if (score < 45) return '#fbbf24';
            if (score < 65) return '#f97316';
            return '#ef4444';
          };

          return (
            <div className="mt-12 bg-[#FAFAFA] rounded-3xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-normal text-[#000000]" style={{ fontFamily: serifFont }}>
                  Historical Risk Trend &mdash; {region}
                </h3>
                <div className="flex items-center gap-4 text-[10px]" style={{ fontFamily: interFont }}>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-400" /><span className="text-[#6F6F6F]">Low</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-[#6F6F6F]">Moderate</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-400" /><span className="text-[#6F6F6F]">High</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="text-[#6F6F6F]">Critical</span></div>
                </div>
              </div>
              <svg width="100%" viewBox={'0 0 ' + W + ' ' + H} className="overflow-visible">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#000" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#000" stopOpacity="1" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                {gridLines.map((g) => (
                  <g key={g.label}>
                    <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} stroke="#E8E8E8" strokeWidth={0.5} strokeDasharray="4,4" />
                    <text x={PAD.left - 8} y={g.y + 3} textAnchor="end" className="text-[9px] fill-[#999]" style={{ fontFamily: interFont }}>{g.label}</text>
                  </g>
                ))}

                {/* Area fill */}
                <path d={areaPath} fill="url(#areaGrad)" />

                {/* Line */}
                <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

                {/* Data points */}
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={3.5} fill={getCatColor(p.score)} stroke="#fff" strokeWidth={1.5} className="cursor-pointer" style={{ transition: 'r 0.2s' }}>
                      <title>{p.year}: Risk {p.score}</title>
                    </circle>
                    {/* Year labels every 2 years */}
                    {i % 2 === 0 && (
                      <text x={p.x} y={PAD.top + cH + 16} textAnchor="middle" className="text-[8px] fill-[#999]" style={{ fontFamily: interFont }}>
                        {p.year}
                      </text>
                    )}
                  </g>
                ))}

                {/* Y axis label */}
                <text x={12} y={PAD.top + cH / 2} textAnchor="middle" transform={'rotate(-90,12,' + (PAD.top + cH / 2) + ')'} className="text-[9px] fill-[#999]" style={{ fontFamily: interFont }}>
                  Risk Score
                </text>
              </svg>

              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#E8E8E8]">
                {[
                  { label: 'Avg Risk', value: (history.reduce((s, h) => s + h.risk_score, 0) / history.length).toFixed(1) },
                  { label: 'Peak Risk', value: Math.max(...history.map((h) => h.risk_score)).toFixed(1) },
                  { label: 'Min Risk', value: Math.min(...history.map((h) => h.risk_score)).toFixed(1) },
                  { label: 'Years', value: String(history.length) },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <span className="text-lg font-normal text-[#000] block" style={{ fontFamily: serifFont }}>{s.value}</span>
                    <span className="text-[10px] text-[#6F6F6F]" style={{ fontFamily: interFont }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
