import { useState, useEffect } from 'react';
import { getRegions, compareRegions } from '../api';

interface RankedRegion {
  rank: number;
  region: string;
  risk_score: number;
  risk_category: string;
}

interface CompResult {
  region: string;
  prediction: {
    risk_score: number;
    risk_category: string;
    confidence: number;
    contributions: { feature: string; display_name: string; value: number; importance: number }[];
  };
}

export default function ComparisonPage() {
  const [allRegions, setAllRegions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ comparison: CompResult[]; ranking: RankedRegion[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRegions().then((d) => setAllRegions(Object.keys(d.regions))).catch(() => {});
  }, []);

  const toggle = (r: string) => {
    setSelected((p) => p.includes(r) ? p.filter((x) => x !== r) : p.length < 6 ? [...p, r] : p);
  };

  const run = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    try {
      const data = await compareRegions(selected);
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
            Regional Comparison
          </span>
          <h1 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-1.5px] text-[#000000]" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Compare <span className="text-[#6F6F6F] italic">regions</span>
          </h1>
          <p className="text-base text-[#6F6F6F] mt-3 max-w-xl" style={{ fontFamily: "'Inter', sans-serif" }}>
            Select 2-6 regions to compare their model-generated risk scores side by side.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {allRegions.map((r) => (
              <button key={r} onClick={() => toggle(r)}
                className={`px-4 py-2 rounded-full text-sm transition-all cursor-pointer border ${
                  selected.includes(r) ? 'bg-[#000000] text-white border-[#000000]' : 'bg-white text-[#6F6F6F] border-[#E8E8E8] hover:border-[#000000]'
                }`}
                style={{ fontFamily: "'Inter', sans-serif" }}>
                {r}
              </button>
            ))}
          </div>
          <button onClick={run} disabled={selected.length < 2 || loading}
            className="px-8 py-3 rounded-xl bg-[#000000] text-white text-sm font-medium transition-all hover:scale-[1.01] disabled:opacity-40 cursor-pointer"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            {loading ? 'Comparing...' : `Compare ${selected.length} Regions`}
          </button>
        </div>

        {result && (
          <div className="space-y-8">
            {/* Ranking */}
            <div className="bg-[#FAFAFA] rounded-3xl p-8">
              <h3 className="text-lg font-normal text-[#000000] mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>
                Risk Ranking
              </h3>
              <div className="space-y-3">
                {result.ranking.map((r) => (
                  <div key={r.region} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#F0F0F0]">
                    <span className="text-2xl font-normal text-[#D0D0D0] w-8 text-center" style={{ fontFamily: "'Instrument Serif', serif" }}>
                      {r.rank}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-[#000000]" style={{ fontFamily: "'Inter', sans-serif" }}>{r.region}</span>
                    </div>
                    <div className="w-40 h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${
                        r.risk_category === 'Critical' ? 'bg-red-500' : r.risk_category === 'High' ? 'bg-orange-500' : r.risk_category === 'Moderate' ? 'bg-amber-500' : 'bg-green-500'
                      } transition-all`} style={{ width: `${r.risk_score}%` }} />
                    </div>
                    <span className="text-lg font-normal text-[#000000] w-12 text-right" style={{ fontFamily: "'Instrument Serif', serif" }}>
                      {r.risk_score}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${riskColor(r.risk_category)}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                      {r.risk_category}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.comparison.map((c) => (
                <div key={c.region} className="bg-white rounded-3xl p-6 border border-[#F0F0F0]">
                  <h4 className="text-xl font-normal text-[#000000] mb-1" style={{ fontFamily: "'Instrument Serif', serif" }}>{c.region}</h4>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-3xl font-normal text-[#000000]" style={{ fontFamily: "'Instrument Serif', serif" }}>{c.prediction.risk_score}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${riskColor(c.prediction.risk_category)}`}>{c.prediction.risk_category}</span>
                  </div>
                  <div className="space-y-1.5">
                    {c.prediction.contributions.slice(0, 4).map((con) => (
                      <div key={con.feature} className="flex items-center justify-between text-xs" style={{ fontFamily: "'Inter', sans-serif" }}>
                        <span className="text-[#6F6F6F]">{con.display_name}</span>
                        <span className="text-[#000000] font-medium">{con.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
