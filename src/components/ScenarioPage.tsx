import { useState, useEffect } from 'react';
import { getRegions, runScenario } from '../api';

interface ScenarioResult {
  base_prediction: { risk_score: number; risk_category: string };
  modified_prediction: { risk_score: number; risk_category: string };
  score_delta: number;
  delta_direction: string;
  changes: { feature: string; old: number; new: number }[];
}

const MODIFIABLE = [
  { key: 'oni_value', label: 'ONI Value', step: 0.1, desc: 'El Nino index (-3 to 3)' },
  { key: 'rainfall_deviation', label: 'Rainfall Deviation', step: 0.05, desc: 'Departure from normal (-2 to 2)' },
  { key: 'temperature_anomaly', label: 'Temperature Anomaly', step: 0.05, desc: 'Degrees above/below normal' },
  { key: 'drought_index', label: 'Drought Index', step: 0.05, desc: 'Severity 0-1' },
  { key: 'crop_production_index', label: 'Crop Production', step: 1, desc: '100 = baseline' },
  { key: 'agricultural_loss_pct', label: 'Agricultural Loss', step: 1, desc: 'Percentage' },
  { key: 'food_security_index', label: 'Food Security', step: 1, desc: '0-100 index' },
  { key: 'malnutrition_pct', label: 'Malnutrition Rate', step: 1, desc: 'Child prevalence %' },
];

export default function ScenarioPage() {
  const [regions, setRegions] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [mods, setMods] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRegions().then((d) => setRegions(Object.keys(d.regions))).catch(() => {});
  }, []);

  const run = async () => {
    if (!region) return;
    setLoading(true);
    try {
      const base: Record<string, unknown> = {
        region, year: 2024, oni_value: 0, rainfall_deviation: 0,
        temperature_anomaly: 0, drought_index: 0.5, crop_production_index: 100,
        crop_yield_tons_ha: 2.5, agricultural_loss_pct: 5, irrigation_coverage_pct: 50,
        malnutrition_pct: 20, food_security_index: 70, infant_mortality_rate: 30, stunting_pct: 25,
      };
      const data = await runScenario(base, mods);
      setResult(data);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <span className="text-xs font-medium tracking-widest uppercase text-[#6F6F6F] mb-3 block" style={{ fontFamily: "'Inter', sans-serif" }}>
            Scenario Analysis
          </span>
          <h1 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-1.5px] text-[#000000]" style={{ fontFamily: "'Instrument Serif', serif" }}>
            What-if <span className="text-[#6F6F6F] italic">analysis</span>
          </h1>
          <p className="text-base text-[#6F6F6F] mt-3 max-w-xl" style={{ fontFamily: "'Inter', sans-serif" }}>
            Modify climate conditions and see how the predicted risk changes. The model recalculates in real-time.
          </p>
        </div>

        <div className="grid md:grid-cols-12 gap-8">
          <div className="md:col-span-5">
            <div className="mb-6">
              <label className="text-sm font-medium text-[#000000] block mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>Region</label>
              <select value={region} onChange={(e) => setRegion(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#FAFAFA] border border-[#E8E8E8] text-sm focus:outline-none focus:border-[#000000] cursor-pointer"
                style={{ fontFamily: "'Inter', sans-serif" }}>
                <option value="">Select a region</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              {MODIFIABLE.map((f) => (
                <div key={f.key} className="bg-[#FAFAFA] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#000000]" style={{ fontFamily: "'Inter', sans-serif" }}>{f.label}</span>
                    <input type="number" value={mods[f.key] ?? 0} step={f.step}
                      onChange={(e) => setMods((p) => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                      className="w-20 text-right text-sm bg-white border border-[#E8E8E8] rounded-lg px-2 py-1 focus:outline-none focus:border-[#000000]"
                      style={{ fontFamily: "'Inter', sans-serif" }} />
                  </div>
                  <input type="range" min={f.key === 'oni_value' ? -3 : 0} max={f.key === 'oni_value' ? 3 : f.key.includes('index') || f.key.includes('food') ? 100 : 80}
                    step={f.step} value={mods[f.key] ?? 0}
                    onChange={(e) => setMods((p) => ({ ...p, [f.key]: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-[#E0E0E0] rounded-full appearance-none cursor-pointer accent-[#000000]" />
                  <span className="text-[10px] text-[#6F6F6F]" style={{ fontFamily: "'Inter', sans-serif" }}>{f.desc}</span>
                </div>
              ))}
            </div>

            <button onClick={run} disabled={!region || loading}
              className="w-full mt-4 py-3 rounded-xl bg-[#000000] text-white text-sm font-medium transition-all hover:scale-[1.01] disabled:opacity-40 cursor-pointer"
              style={{ fontFamily: "'Inter', sans-serif" }}>
              {loading ? 'Calculating...' : 'Run Scenario Analysis'}
            </button>
          </div>

          <div className="md:col-span-7">
            {result ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#FAFAFA] rounded-3xl p-6 border border-[#F0F0F0]">
                    <span className="text-xs text-[#6F6F6F] block mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>Baseline Risk</span>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-normal text-[#000000]" style={{ fontFamily: "'Instrument Serif', serif" }}>{result.base_prediction.risk_score}</span>
                      <span className="text-sm text-[#6F6F6F] mb-1">/100</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8E8E8] text-[#6F6F6F] mt-2 inline-block" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {result.base_prediction.risk_category}
                    </span>
                  </div>
                  <div className="bg-[#000000] rounded-3xl p-6 text-white">
                    <span className="text-xs text-white/50 block mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>Modified Risk</span>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-normal" style={{ fontFamily: "'Instrument Serif', serif" }}>{result.modified_prediction.risk_score}</span>
                      <span className="text-sm text-white/50 mb-1">/100</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white mt-2 inline-block" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {result.modified_prediction.risk_category}
                    </span>
                  </div>
                </div>

                <div className={`rounded-2xl p-4 text-center ${result.delta_direction === 'increased' ? 'bg-red-50 text-red-700' : result.delta_direction === 'decreased' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}>
                  <span className="text-sm font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Risk {result.delta_direction} by {Math.abs(result.score_delta)} points
                    {result.delta_direction === 'increased' ? ' (worse)' : result.delta_direction === 'decreased' ? ' (improved)' : ''}
                  </span>
                </div>

                {result.changes.length > 0 && (
                  <div className="bg-[#FAFAFA] rounded-3xl p-6">
                    <h4 className="text-sm font-medium text-[#000000] mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>Applied Changes</h4>
                    <div className="space-y-2">
                      {result.changes.map((c) => (
                        <div key={c.feature} className="flex items-center justify-between text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
                          <span className="text-[#6F6F6F]">{c.feature.replace(/_/g, ' ')}</span>
                          <span className="text-[#000000] font-medium">{c.old} &rarr; {c.new}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#FAFAFA] rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                <svg className="w-12 h-12 text-[#D0D0D0] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                <p className="text-sm text-[#6F6F6F]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Select a region and modify conditions to run a scenario
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
