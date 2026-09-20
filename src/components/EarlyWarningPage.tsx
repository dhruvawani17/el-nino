import { useState } from 'react';
import { earlyWarning } from '../api';

interface Warning {
  region: string;
  risk_score: number;
  risk_category: string;
  top_factor: { display_name: string; value: number } | null;
}

export default function EarlyWarningPage() {
  const [threshold, setThreshold] = useState(60);
  const [result, setResult] = useState<{ threshold: number; total_warnings: number; warnings: Warning[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const data = await earlyWarning(threshold);
      setResult(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const riskColor = (cat: string) => {
    if (cat === 'Critical') return 'text-red-600 bg-red-50 border-red-200';
    if (cat === 'High') return 'text-orange-600 bg-orange-50 border-orange-200';
    if (cat === 'Moderate') return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <span className="text-xs font-medium tracking-widest uppercase text-[#6F6F6F] mb-3 block" style={{ fontFamily: "'Inter', sans-serif" }}>
            Early Warning System
          </span>
          <h1 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-1.5px] text-[#000000]" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Identify <span className="text-[#6F6F6F] italic">at-risk</span> regions
          </h1>
          <p className="text-base text-[#6F6F6F] mt-3 max-w-xl" style={{ fontFamily: "'Inter', sans-serif" }}>
            Set a risk threshold and the system will flag all regions whose predicted risk exceeds that level.
          </p>
        </div>

        <div className="flex items-center gap-6 mb-8">
          <div className="flex-1 max-w-sm">
            <label className="text-sm font-medium text-[#000000] block mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
              Risk Threshold: {threshold}
            </label>
            <input type="range" min={0} max={100} step={5} value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full h-2 bg-[#E0E0E0] rounded-full appearance-none cursor-pointer accent-[#000000]" />
            <div className="flex justify-between text-xs text-[#6F6F6F] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              <span>0 (No risk)</span><span>50 (Moderate)</span><span>100 (Extreme)</span>
            </div>
          </div>
          <button onClick={run} disabled={loading}
            className="px-8 py-3 rounded-xl bg-[#000000] text-white text-sm font-medium transition-all hover:scale-[1.01] disabled:opacity-40 cursor-pointer"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            {loading ? 'Scanning...' : 'Scan Regions'}
          </button>
        </div>

        {result && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-[#000000] text-white rounded-2xl px-6 py-4 text-center">
                <span className="text-3xl font-normal block" style={{ fontFamily: "'Instrument Serif', serif" }}>{result.total_warnings}</span>
                <span className="text-xs text-white/60" style={{ fontFamily: "'Inter', sans-serif" }}>Regions Flagged</span>
              </div>
              <div className="bg-[#FAFAFA] rounded-2xl px-6 py-4 text-center border border-[#F0F0F0]">
                <span className="text-3xl font-normal text-[#000000] block" style={{ fontFamily: "'Instrument Serif', serif" }}>{threshold}</span>
                <span className="text-xs text-[#6F6F6F]" style={{ fontFamily: "'Inter', sans-serif" }}>Threshold</span>
              </div>
            </div>

            {result.warnings.length === 0 ? (
              <div className="bg-[#FAFAFA] rounded-3xl p-12 text-center">
                <p className="text-lg text-[#6F6F6F]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  No regions exceed the {threshold} risk threshold.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.warnings.map((w) => (
                  <div key={w.region} className="bg-white rounded-2xl p-6 border border-[#F0F0F0] flex items-center gap-6 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-[#FAFAFA] flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-[#000000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-normal text-[#000000]" style={{ fontFamily: "'Instrument Serif', serif" }}>{w.region}</h4>
                      {w.top_factor && (
                        <p className="text-xs text-[#6F6F6F] mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                          Primary factor: {w.top_factor.display_name} ({w.top_factor.value})
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-normal text-[#000000]" style={{ fontFamily: "'Instrument Serif', serif" }}>{w.risk_score}</span>
                      <span className={`block text-xs px-2 py-0.5 rounded-full border mt-1 ${riskColor(w.risk_category)}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                        {w.risk_category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
