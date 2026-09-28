import { useState, useEffect } from 'react';
import { getRegions, get3YearForecast } from '../api';

interface RegionProfile {
  avg_risk_score: number;
  risk_category: string;
  data_years: number;
}

interface YearProjection {
  year: number;
  phase: string;
  risk_score: number;
  risk_category: string;
  metrics: {
    oni_value: number;
    rainfall_deviation: number;
    temperature_anomaly: number;
    drought_index: number;
    crop_production_index: number;
    crop_yield_tons_ha: number;
    agricultural_loss_pct: number;
    irrigation_coverage_pct: number;
    malnutrition_pct: number;
    food_security_index: number;
    infant_mortality_rate: number;
    stunting_pct: number;
  };
  contributions: {
    feature: string;
    display_name: string;
    value: number;
    importance: number;
  }[];
}

interface LLMAnalysis {
  llm_provider?: string;
  executive_summary: string;
  rainfall_outlook: string;
  crop_outlook: string;
  child_health_mortality_outlook: string;
  yearly_breakdown: Record<
    string,
    {
      phase: string;
      rainfall_summary: string;
      crop_summary: string;
      child_health_summary: string;
      priority_action: string;
    }
  >;
  policy_recommendations: {
    sector: string;
    action: string;
  }[];
}

interface ForecastResponse {
  region: string;
  base_year: number;
  forecast_years: number[];
  base_2026: {
    prediction: {
      risk_score: number;
      risk_category: string;
    };
    metrics: {
      oni_value: number;
      rainfall_deviation: number;
      temperature_anomaly: number;
      drought_index: number;
      crop_production_index: number;
      crop_yield_tons_ha: number;
      agricultural_loss_pct: number;
      irrigation_coverage_pct: number;
      malnutrition_pct: number;
      food_security_index: number;
      infant_mortality_rate: number;
      stunting_pct: number;
    };
  };
  yearly_projections: YearProjection[];
  llm_analysis: LLMAnalysis;
}

const serifFont = "'Instrument Serif', serif";
const interFont = "'Inter', sans-serif";

interface ForecastPageProps {
  initialRegion?: string;
}

export default function ForecastPage({ initialRegion }: ForecastPageProps) {
  const [regions, setRegions] = useState<Record<string, RegionProfile>>({});
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion || 'Bihar');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState<'All' | 'Low' | 'Moderate' | 'High'>('All');
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | '2027' | '2028' | '2029'>('all');
  const [chartMetric, setChartMetric] = useState<'risk' | 'rainfall' | 'crops' | 'mortality'>('risk');

  // Load regions on mount
  useEffect(() => {
    getRegions()
      .then((res) => {
        setRegions(res.regions || {});
        if (!initialRegion && res.regions && Object.keys(res.regions).length > 0) {
          const first = Object.keys(res.regions)[0];
          setSelectedRegion(first);
        }
      })
      .catch(() => {});
  }, [initialRegion]);

  // Load forecast whenever selectedRegion changes
  useEffect(() => {
    if (!selectedRegion) return;
    loadForecast(selectedRegion);
  }, [selectedRegion]);

  const loadForecast = async (reg: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await get3YearForecast(reg);
      setForecast(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate 3-year forecast');
    } finally {
      setLoading(false);
    }
  };

  const filteredRegions = Object.entries(regions)
    .filter(([name, prof]) => {
      const matchSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = filterCat === 'All' || prof.risk_category === filterCat;
      return matchSearch && matchCat;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  const getRiskBadgeColor = (cat: string) => {
    switch (cat) {
      case 'Critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'High':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="pt-24 pb-20 px-6 max-w-7xl mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-8 border-b border-[#F0F0F0] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5F5F7] border border-[#E5E5EA] text-xs text-[#1D1D1F] font-medium mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Machine Learning Projections
            </div>
            <h1 className="text-4xl md:text-5xl font-normal text-[#1D1D1F] tracking-tight" style={{ fontFamily: serifFont }}>
              3-Year Predictive Horizon (2027–2029)
            </h1>
            <p className="text-sm md:text-base text-[#6F6F6F] mt-2 max-w-2xl" style={{ fontFamily: interFont }}>
              Select any Indian state to evaluate multi-year post-El Niño dynamics. The trained ML model predicts annual risk, 
              rainfall deviations, crop productivity, and child mortality indices.
            </p>
          </div>


        {/* State Selection Bar */}
        <div className="mt-8 bg-white border border-[#E5E5EA] rounded-2xl p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider">Select State / Region:</span>
              <span className="text-xs text-[#86868B]">({filteredRegions.length} of {Object.keys(regions).length} regions)</span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-[#F5F5F7] p-1 rounded-lg">
              {(['All', 'Low', 'Moderate', 'High'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                    filterCat === cat ? 'bg-white text-black shadow-xs' : 'text-[#6F6F6F] hover:text-black'
                  }`}
                  style={{ fontFamily: interFont }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs px-3 py-1.5 bg-[#F5F5F7] border border-[#E5E5EA] rounded-lg outline-none focus:border-black w-44"
              style={{ fontFamily: interFont }}
            />
          </div>

          {/* Quick Region Pills */}
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {filteredRegions.map(([name, prof]) => {
              const isSelected = selectedRegion === name;
              const catClass = prof.risk_category === 'High'
                ? 'text-orange-700 bg-orange-50/60 border-orange-200'
                : prof.risk_category === 'Moderate'
                ? 'text-amber-700 bg-amber-50/60 border-amber-200'
                : 'text-emerald-700 bg-emerald-50/60 border-emerald-200';

              return (
                <button
                  key={name}
                  onClick={() => setSelectedRegion(name)}
                  className={`px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-black text-white border-black shadow-sm font-semibold'
                      : `${catClass} hover:border-black/40`
                  }`}
                  style={{ fontFamily: interFont }}
                >
                  <span>{name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-black/5'}`}>
                    {prof.avg_risk_score}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-24 text-center">
          <div className="inline-block w-10 h-10 border-3 border-black border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-base font-medium text-[#1D1D1F]">Generating ML 3-Year Projection for {selectedRegion}...</p>
          <p className="text-xs text-[#86868B] mt-1">Simulating ENSO decay (2027), La Niña surge (2028), and compiling multi-year indicators...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700 mb-8">
          <p className="font-semibold text-sm">{error}</p>
          <button
            onClick={() => loadForecast(selectedRegion)}
            className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 cursor-pointer"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* Forecast Content */}
      {forecast && !loading && (
        <div className="space-y-10">
          {/* Top Summary Comparison Card */}
          <div className="bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] text-white rounded-3xl p-6 md:p-8 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <span className="text-xs uppercase tracking-widest text-[#86868B] font-semibold">State Analysis</span>
                <h2 className="text-3xl md:text-4xl font-normal mt-1" style={{ fontFamily: serifFont }}>
                  {forecast.region} — Post-El Niño 3-Year Trajectory
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs text-[#86868B] block">2026 El Niño Peak</span>
                  <span className="text-2xl font-semibold text-rose-400">
                    Risk {forecast.base_2026.prediction.risk_score}
                  </span>
                </div>
                <span className="text-2xl text-white/30">→</span>
                <div className="text-left">
                  <span className="text-xs text-[#86868B] block">2029 Normalized</span>
                  <span className="text-2xl font-semibold text-emerald-400">
                    Risk {forecast.yearly_projections[2].risk_score}
                  </span>
                </div>
              </div>
            </div>

            {/* Multi-Sector Stat Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="text-xs text-white/60 block">🌧️ Rainfall Recovery</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold">
                    {forecast.yearly_projections[1].metrics.rainfall_deviation > 0 ? '+' : ''}
                    {(forecast.yearly_projections[1].metrics.rainfall_deviation * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-emerald-400">Surplus by 2028</span>
                </div>
                <span className="text-[11px] text-white/40 block mt-1">From {(forecast.base_2026.metrics.rainfall_deviation * 100).toFixed(1)}% deficit in 2026</span>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="text-xs text-white/60 block">🌾 Crop Production Index</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold">{forecast.yearly_projections[1].metrics.crop_production_index}</span>
                  <span className="text-xs text-emerald-400">
                    +{(forecast.yearly_projections[1].metrics.crop_production_index - forecast.base_2026.metrics.crop_production_index).toFixed(1)} pts
                  </span>
                </div>
                <span className="text-[11px] text-white/40 block mt-1">Losses drop to {forecast.yearly_projections[1].metrics.agricultural_loss_pct}%</span>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="text-xs text-white/60 block">👶 Infant Mortality Rate</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold">{forecast.yearly_projections[2].metrics.infant_mortality_rate}</span>
                  <span className="text-xs text-emerald-400">
                    {(forecast.yearly_projections[2].metrics.infant_mortality_rate - forecast.base_2026.metrics.infant_mortality_rate).toFixed(1)} /1k
                  </span>
                </div>
                <span className="text-[11px] text-white/40 block mt-1">Down from {forecast.base_2026.metrics.infant_mortality_rate} in 2026</span>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="text-xs text-white/60 block">🥗 Child Malnutrition</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold">{forecast.yearly_projections[2].metrics.malnutrition_pct}%</span>
                  <span className="text-xs text-emerald-400">
                    {(forecast.yearly_projections[2].metrics.malnutrition_pct - forecast.base_2026.metrics.malnutrition_pct).toFixed(1)}%
                  </span>
                </div>
                <span className="text-[11px] text-white/40 block mt-1">Food security: {forecast.yearly_projections[2].metrics.food_security_index}/100</span>
              </div>
            </div>
          </div>

          {/* 3 Year Cards (2027, 2028, 2029) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl text-[#1D1D1F] font-normal" style={{ fontFamily: serifFont }}>
                  Year-by-Year ML Projections
                </h3>
                <p className="text-xs text-[#6F6F6F]" style={{ fontFamily: interFont }}>
                  Calculated using Gradient Boosting Regressor across Climate, Agronomic, and Nutritional indicators
                </p>
              </div>

              {/* View filter */}
              <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl">
                {(['all', '2027', '2028', '2029'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                      activeTab === tab ? 'bg-white text-black shadow-xs' : 'text-[#6F6F6F] hover:text-black'
                    }`}
                    style={{ fontFamily: interFont }}
                  >
                    {tab === 'all' ? 'All 3 Years' : `Year ${tab}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {forecast.yearly_projections
                .filter((p) => activeTab === 'all' || String(p.year) === activeTab)
                .map((yp) => {
                  const m = yp.metrics;
                  const rainDev = (m.rainfall_deviation * 100).toFixed(1);
                  const deltaRisk = (yp.risk_score - forecast.base_2026.prediction.risk_score).toFixed(1);

                  return (
                    <div
                      key={yp.year}
                      className="bg-white border border-[#E5E5EA] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
                    >
                      {/* Top ribbon */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-[#1D1D1F]">{yp.year}</span>
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA]">
                              {yp.phase}
                            </span>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getRiskBadgeColor(yp.risk_category)}`}>
                            {yp.risk_category}
                          </span>
                        </div>

                        {/* ML Score Display */}
                        <div className="bg-[#FAFAFA] border border-[#F0F0F0] rounded-2xl p-4 mb-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[11px] uppercase tracking-wider text-[#86868B] block font-semibold">
                                ML Risk Score
                              </span>
                              <span className="text-3xl font-extrabold text-[#1D1D1F]">{yp.risk_score}</span>
                              <span className="text-xs text-[#86868B]"> / 100</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] text-[#86868B] block">vs 2026 Peak</span>
                              <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {Number(deltaRisk) <= 0 ? deltaRisk : `+${deltaRisk}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Indicators Breakdown */}
                        <div className="space-y-3 text-xs">
                          {/* Rainfall */}
                          <div className="p-3 bg-[#F9F9FB] rounded-xl border border-[#F0F0F0]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                                🌧️ Rainfall & Monsoon
                              </span>
                              <span className={`font-bold ${m.rainfall_deviation >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                                {Number(rainDev) > 0 ? `+${rainDev}%` : `${rainDev}%`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[#86868B] text-[11px]">
                              <span>Drought Severity Index</span>
                              <span className="font-medium text-[#1D1D1F]">{m.drought_index.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#86868B] text-[11px] mt-0.5">
                              <span>ENSO ONI Value</span>
                              <span className="font-medium text-[#1D1D1F]">{m.oni_value}</span>
                            </div>
                          </div>

                          {/* Crops */}
                          <div className="p-3 bg-[#F9F9FB] rounded-xl border border-[#F0F0F0]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                                🌾 Crops & Yields
                              </span>
                              <span className="font-bold text-[#1D1D1F]">{m.crop_production_index} idx</span>
                            </div>
                            <div className="flex items-center justify-between text-[#86868B] text-[11px]">
                              <span>Crop Yield (t/ha)</span>
                              <span className="font-medium text-[#1D1D1F]">{m.crop_yield_tons_ha}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#86868B] text-[11px] mt-0.5">
                              <span>Agricultural Loss %</span>
                              <span className="font-semibold text-rose-600">{m.agricultural_loss_pct}%</span>
                            </div>
                          </div>

                          {/* Child Health */}
                          <div className="p-3 bg-[#F9F9FB] rounded-xl border border-[#F0F0F0]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                                👶 Child Health & Mortality
                              </span>
                              <span className="font-bold text-rose-700">{m.infant_mortality_rate} / 1k</span>
                            </div>
                            <div className="flex items-center justify-between text-[#86868B] text-[11px]">
                              <span>Child Malnutrition %</span>
                              <span className="font-medium text-[#1D1D1F]">{m.malnutrition_pct}%</span>
                            </div>
                            <div className="flex items-center justify-between text-[#86868B] text-[11px] mt-0.5">
                              <span>Food Security Index</span>
                              <span className="font-medium text-[#1D1D1F]">{m.food_security_index} / 100</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Top Factor Tag */}
                      <div className="mt-4 pt-3 border-t border-[#F0F0F0] text-[11px] text-[#86868B] flex items-center justify-between">
                        <span>Key Driver:</span>
                        <span className="font-medium text-[#1D1D1F]">
                          {yp.contributions[0]?.display_name || 'Climate Equilibrium'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Interactive Multi-Year Trajectory Chart */}
          <div className="bg-white border border-[#E5E5EA] rounded-3xl p-6 md:p-8 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl text-[#1D1D1F] font-normal" style={{ fontFamily: serifFont }}>
                  4-Year Multi-Sector Trajectory Curve (2026 Actual → 2029 Forecast)
                </h3>
                <p className="text-xs text-[#6F6F6F]" style={{ fontFamily: interFont }}>
                  Visualizing transition curves from El Niño peak to post-event stabilization in {forecast.region}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#F5F5F7] p-1 rounded-xl">
                {[
                  { id: 'risk', label: 'Risk Score' },
                  { id: 'rainfall', label: 'Rainfall Dev %' },
                  { id: 'crops', label: 'Crop Production' },
                  { id: 'mortality', label: 'Infant Mortality' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setChartMetric(m.id as typeof chartMetric)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                      chartMetric === m.id ? 'bg-black text-white shadow-xs' : 'text-[#6F6F6F] hover:text-black'
                    }`}
                    style={{ fontFamily: interFont }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Visualizer */}
            {(() => {
              const years = [2026, 2027, 2028, 2029];
              let values: number[] = [];
              let unit = '';
              let lineColor = '#000000';

              if (chartMetric === 'risk') {
                values = [
                  forecast.base_2026.prediction.risk_score,
                  ...forecast.yearly_projections.map((p) => p.risk_score),
                ];
                unit = 'Score';
                lineColor = '#DC2626';
              } else if (chartMetric === 'rainfall') {
                values = [
                  forecast.base_2026.metrics.rainfall_deviation * 100,
                  ...forecast.yearly_projections.map((p) => p.metrics.rainfall_deviation * 100),
                ];
                unit = '%';
                lineColor = '#2563EB';
              } else if (chartMetric === 'crops') {
                values = [
                  forecast.base_2026.metrics.crop_production_index,
                  ...forecast.yearly_projections.map((p) => p.metrics.crop_production_index),
                ];
                unit = 'Index';
                lineColor = '#16A34A';
              } else {
                values = [
                  forecast.base_2026.metrics.infant_mortality_rate,
                  ...forecast.yearly_projections.map((p) => p.metrics.infant_mortality_rate),
                ];
                unit = '/ 1000';
                lineColor = '#9333EA';
              }

              const minV = Math.min(...values);
              const maxV = Math.max(...values);
              const pad = (maxV - minV) * 0.2 || 5;
              const yMin = minV - pad;
              const yMax = maxV + pad;

              const W = 800;
              const H = 220;
              const P = { top: 20, right: 40, bottom: 40, left: 60 };
              const cW = W - P.left - P.right;
              const cH = H - P.top - P.bottom;

              const pts = values.map((val, idx) => {
                const x = P.left + (idx / (values.length - 1)) * cW;
                const y = P.top + cH - ((val - yMin) / (yMax - yMin)) * cH;
                return { x, y, val, year: years[idx] };
              });

              const pathD = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

              return (
                <div className="w-full overflow-x-auto">
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px] h-52">
                    {/* Horizontal grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                      const y = P.top + cH * pct;
                      const gridVal = yMax - pct * (yMax - yMin);
                      return (
                        <g key={pct}>
                          <line x1={P.left} y1={y} x2={W - P.right} y2={y} stroke="#F0F0F0" strokeWidth={1} strokeDasharray="4 4" />
                          <text x={P.left - 10} y={y + 3} textAnchor="end" className="text-[10px] fill-[#86868B]" style={{ fontFamily: interFont }}>
                            {gridVal.toFixed(1)} {unit}
                          </text>
                        </g>
                      );
                    })}

                    {/* Chart Line */}
                    <path d={pathD} fill="none" stroke={lineColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

                    {/* Data Points */}
                    {pts.map((p) => (
                      <g key={p.year}>
                        <circle cx={p.x} cy={p.y} r={6} fill="#FFFFFF" stroke={lineColor} strokeWidth={3} />
                        <text
                          x={p.x}
                          y={p.y - 12}
                          textAnchor="middle"
                          className="text-[11px] font-bold fill-[#1D1D1F]"
                          style={{ fontFamily: interFont }}
                        >
                          {p.val.toFixed(1)}
                        </text>
                        <text
                          x={p.x}
                          y={P.top + cH + 20}
                          textAnchor="middle"
                          className={`text-xs ${p.year === 2026 ? 'fill-rose-600 font-semibold' : 'fill-[#86868B]'}`}
                          style={{ fontFamily: interFont }}
                        >
                          {p.year} {p.year === 2026 ? '(El Niño)' : ''}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              );
            })()}
          </div>

          {/* Multi-Sector Advisory Section */}
          <div className="bg-[#FAF9F5] border border-[#E8E6DF] rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="mb-6 pb-6 border-b border-[#E8E6DF]">
              <h3 className="text-3xl font-normal text-[#1D1D1F]" style={{ fontFamily: serifFont }}>
                Comprehensive Multi-Sector 3-Year Advisory
              </h3>
              <p className="text-xs text-[#6F6F6F] mt-1" style={{ fontFamily: interFont }}>
                Detailed synthesis of climate rainfall, agricultural security, and child health for {forecast.region}
              </p>
            </div>

            {/* Executive Summary Box */}
            <div className="bg-white border border-[#E8E6DF] rounded-2xl p-6 mb-8 shadow-xs">
              <span className="text-xs uppercase tracking-wider font-bold text-amber-800 block mb-2">
                Executive Synthesis
              </span>
              <p className="text-sm md:text-base text-[#2C2C2E] leading-relaxed" style={{ fontFamily: interFont }}>
                {forecast.llm_analysis.executive_summary}
              </p>
            </div>

            {/* 3 Core Analytical Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Rainfall Pillar */}
              <div className="bg-white border border-[#E8E6DF] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-4">
                    🌧️
                  </div>
                  <h4 className="text-lg font-semibold text-[#1D1D1F] mb-2" style={{ fontFamily: interFont }}>
                    Rainfall & Monsoon Outlook
                  </h4>
                  <p className="text-xs text-[#48484A] leading-relaxed" style={{ fontFamily: interFont }}>
                    {forecast.llm_analysis.rainfall_outlook}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F0EFEB] text-[11px] text-blue-700 font-medium">
                  2028: La Niña Precipitation Surge
                </div>
              </div>

              {/* Crop Pillar */}
              <div className="bg-white border border-[#E8E6DF] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mb-4">
                    🌾
                  </div>
                  <h4 className="text-lg font-semibold text-[#1D1D1F] mb-2" style={{ fontFamily: interFont }}>
                    Crop Production & Yields
                  </h4>
                  <p className="text-xs text-[#48484A] leading-relaxed" style={{ fontFamily: interFont }}>
                    {forecast.llm_analysis.crop_outlook}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F0EFEB] text-[11px] text-emerald-700 font-medium">
                  Production index rebounds past baseline
                </div>
              </div>

              {/* Child Health Pillar */}
              <div className="bg-white border border-[#E8E6DF] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl mb-4">
                    👶
                  </div>
                  <h4 className="text-lg font-semibold text-[#1D1D1F] mb-2" style={{ fontFamily: interFont }}>
                    Child Health & Mortality
                  </h4>
                  <p className="text-xs text-[#48484A] leading-relaxed" style={{ fontFamily: interFont }}>
                    {forecast.llm_analysis.child_health_mortality_outlook}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F0EFEB] text-[11px] text-rose-700 font-medium">
                  Progressive reduction in IMR & stunting lags
                </div>
              </div>
            </div>

            {/* Year-by-Year Strategic Action Matrix */}
            <div className="bg-white border border-[#E8E6DF] rounded-2xl p-6 mb-8 shadow-xs">
              <h4 className="text-xl font-normal text-[#1D1D1F] mb-4" style={{ fontFamily: serifFont }}>
                Year-by-Year Priority Action Matrix
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(['2027', '2028', '2029'] as const).map((yr) => {
                  const b = forecast.llm_analysis.yearly_breakdown?.[yr];
                  if (!b) return null;

                  return (
                    <div key={yr} className="bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl p-4 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-[#1D1D1F]">{yr}</span>
                        <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded-full font-medium">
                          {b.phase}
                        </span>
                      </div>

                      <div className="space-y-2 mt-3 text-[#3A3A3C]">
                        <div>
                          <strong className="text-[#1D1D1F] block text-[11px]">🌧️ Monsoon:</strong>
                          <span>{b.rainfall_summary}</span>
                        </div>
                        <div>
                          <strong className="text-[#1D1D1F] block text-[11px]">🌾 Crops:</strong>
                          <span>{b.crop_summary}</span>
                        </div>
                        <div>
                          <strong className="text-[#1D1D1F] block text-[11px]">👶 Health:</strong>
                          <span>{b.child_health_summary}</span>
                        </div>
                        <div className="pt-2 border-t border-[#E8E6DF]">
                          <strong className="text-amber-900 block text-[11px]">🎯 Priority Action:</strong>
                          <span className="text-amber-800 font-medium">{b.priority_action}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sectoral Policy Recommendations */}
            {forecast.llm_analysis.policy_recommendations && forecast.llm_analysis.policy_recommendations.length > 0 && (
              <div className="bg-white border border-[#E8E6DF] rounded-2xl p-6 shadow-xs">
                <h4 className="text-xl font-normal text-[#1D1D1F] mb-4" style={{ fontFamily: serifFont }}>
                  Multi-Sector Institutional Policy Recommendations
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {forecast.llm_analysis.policy_recommendations.map((rec, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
                      <span className="text-xs font-bold text-black uppercase tracking-wider block mb-1">
                        {rec.sector}
                      </span>
                      <p className="text-xs text-[#48484A] leading-relaxed" style={{ fontFamily: interFont }}>
                        {rec.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
