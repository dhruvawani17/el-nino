import { useState } from 'react';
import type { IndiaStateFeature } from '../../data/indiaMapData';
import type { RegionMetrics } from '../../data/regionalRiskData';
import {
  getRiskCategory,
  getRiskColorClass,
  REGION_HISTORIES,
} from '../../data/regionalRiskData';
import RadarChart from '../charts/RadarChart';

interface StateDossierDrawerProps {
  state: IndiaStateFeature;
  metrics: RegionMetrics;
  onClose: () => void;
  onNavigateToAnalysis?: (regionName: string) => void;
  onNavigateToForecast?: (regionName: string) => void;
  onNavigateToCompare?: (regionName: string) => void;
}

export default function StateDossierDrawer({
  state,
  metrics,
  onClose,
  onNavigateToAnalysis,
  onNavigateToForecast,
  onNavigateToCompare,
}: StateDossierDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'advisory'>('overview');

  const riskCat = getRiskCategory(metrics.risk_score);
  const colorClass = getRiskColorClass(riskCat);
  const history = REGION_HISTORIES[state.modelRegion] || [];

  const interFont = "'Inter', sans-serif";
  const serifFont = "'Instrument Serif', serif";

  const radarData = [
    { label: 'Climate Shock', value: Math.min(100, Math.max(10, ((metrics.oni_value + 3) / 6) * 100)) },
    { label: 'Drought Index', value: metrics.drought_index * 100 },
    { label: 'Crop Production Loss', value: Math.max(0, 130 - metrics.crop_production_index) / 80 * 100 },
    { label: 'Ag Loss %', value: (metrics.agricultural_loss_pct / 40) * 100 },
    { label: 'Child Malnutrition', value: (metrics.malnutrition_pct / 50) * 100 },
    { label: 'Food Insecurity', value: 100 - (metrics.food_security_index / 95) * 100 },
    { label: 'Infant Mortality', value: (metrics.infant_mortality_rate / 60) * 100 },
    { label: 'Child Stunting', value: (metrics.stunting_pct / 50) * 100 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer content */}
      <div className="relative z-10 w-full max-w-xl bg-white h-full shadow-2xl border-l border-[#E5E5E5] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#F0F0F0] bg-[#FAFAFA] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]" style={{ fontFamily: interFont }}>
                {state.zone} Zone • Capital: {state.capital}
              </span>
              <span className="text-xs font-mono font-medium text-[#737373] px-2 py-0.5 bg-white rounded border border-[#E5E5E5]">
                {state.code}
              </span>
            </div>
            <h2 className="text-3xl font-normal text-[#111111] leading-tight" style={{ fontFamily: serifFont }}>
              {state.name}
            </h2>
            <p className="text-xs text-[#6F6F6F] mt-1" style={{ fontFamily: interFont }}>
              Mapped ML Model Region: <span className="font-semibold text-black">{state.modelRegion}</span>
              {state.subRegions && state.subRegions.length > 0 && ` (${state.subRegions.join(', ')})`}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#888888] hover:text-black hover:bg-[#EAEAEA] transition-colors cursor-pointer"
              title="Close Drawer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${colorClass.bg} ${colorClass.text} ${colorClass.border}`}
              style={{ fontFamily: interFont }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colorClass.fill }} />
              {riskCat} Risk ({metrics.risk_score.toFixed(1)}/100)
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#F0F0F0] px-6 bg-white">
          {[
            { id: 'overview' as const, label: 'Overview & Radar' },
            { id: 'trends' as const, label: '10-Year Trends' },
            { id: 'advisory' as const, label: 'Early Warning & Advisory' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-black text-black font-semibold'
                  : 'border-transparent text-[#737373] hover:text-black'
              }`}
              style={{ fontFamily: interFont }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Primary Score Card */}
              <div className="bg-[#FAFAFA] rounded-2xl p-5 border border-[#EEEEEE]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-[#737373] block" style={{ fontFamily: interFont }}>
                      Composite Vulnerability Score
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-4xl font-normal text-black" style={{ fontFamily: serifFont }}>
                        {metrics.risk_score.toFixed(1)}
                      </span>
                      <span className="text-xs text-[#737373]">/ 100 (Model Calibrated)</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[#737373] block" style={{ fontFamily: interFont }}>National Rank</span>
                    <span className="text-lg font-semibold text-black" style={{ fontFamily: interFont }}>
                      {metrics.risk_score >= 47 ? 'Top 10 High Exposure' : metrics.risk_score >= 43 ? 'Mid Tier Vulnerability' : 'Resilient / Low Risk'}
                    </span>
                  </div>
                </div>

                <div className="h-2.5 w-full bg-[#E5E5E5] rounded-full overflow-hidden p-[1px]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (metrics.risk_score / 60) * 100)}%`,
                      backgroundColor: colorClass.fill,
                    }}
                  />
                </div>
              </div>

              {/* Radar Chart */}
              <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] flex flex-col items-center">
                <h4 className="text-xs font-semibold text-black uppercase tracking-wider mb-2" style={{ fontFamily: interFont }}>
                  Multi-Sector Vulnerability Profile
                </h4>
                <RadarChart data={radarData} size={240} />
              </div>

              {/* Multi-Sector Indicators Table */}
              <div>
                <h4 className="text-xs font-semibold text-black uppercase tracking-wider mb-3" style={{ fontFamily: interFont }}>
                  Detailed Sector Indicators (2026 Active Baseline)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#EFEFEF]">
                    <span className="text-[10px] uppercase text-[#737373] block" style={{ fontFamily: interFont }}>Climate / Rainfall</span>
                    <div className="text-base font-semibold mt-1" style={{ fontFamily: interFont }}>
                      {metrics.rainfall_deviation >= 0 ? '+' : ''}{(metrics.rainfall_deviation * 100).toFixed(1)}% Dev.
                    </div>
                    <span className="text-[10px] text-[#888888]">Drought Index: {metrics.drought_index.toFixed(2)} / 1.0</span>
                  </div>

                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#EFEFEF]">
                    <span className="text-[10px] uppercase text-[#737373] block" style={{ fontFamily: interFont }}>Crop Production</span>
                    <div className="text-base font-semibold mt-1" style={{ fontFamily: interFont }}>
                      {metrics.crop_production_index.toFixed(1)} <span className="text-xs font-normal text-[#737373]">(100 baseline)</span>
                    </div>
                    <span className="text-[10px] text-[#888888]">Yield: {metrics.crop_yield_tons_ha.toFixed(2)} t/ha</span>
                  </div>

                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#EFEFEF]">
                    <span className="text-[10px] uppercase text-[#737373] block" style={{ fontFamily: interFont }}>Ag Economic Loss</span>
                    <div className="text-base font-semibold text-red-600 mt-1" style={{ fontFamily: interFont }}>
                      {metrics.agricultural_loss_pct.toFixed(1)}% Loss
                    </div>
                    <span className="text-[10px] text-[#888888]">Irrigation: {metrics.irrigation_coverage_pct.toFixed(1)}%</span>
                  </div>

                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#EFEFEF]">
                    <span className="text-[10px] uppercase text-[#737373] block" style={{ fontFamily: interFont }}>Public Health & IMR</span>
                    <div className="text-base font-semibold text-amber-600 mt-1" style={{ fontFamily: interFont }}>
                      {metrics.malnutrition_pct.toFixed(1)}% Malnutrition
                    </div>
                    <span className="text-[10px] text-[#888888]">IMR: {metrics.infant_mortality_rate.toFixed(0)} per 1,000 births</span>
                  </div>
                </div>
              </div>

              {/* State Agricultural Profile */}
              <div className="bg-[#FAFAFA] rounded-2xl p-4 border border-[#EEEEEE]">
                <h4 className="text-xs font-semibold text-black uppercase tracking-wider mb-2" style={{ fontFamily: interFont }}>
                  Primary Kharif & Rabi Crops
                </h4>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {state.crops.map((crop) => (
                    <span
                      key={crop}
                      className="px-2.5 py-1 rounded-full text-xs bg-white border border-[#E5E5E5] text-black font-medium"
                      style={{ fontFamily: interFont }}
                    >
                      🌱 {crop}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-[#6F6F6F] leading-relaxed" style={{ fontFamily: interFont }}>
                  <span className="font-semibold text-black">Climatic Sensitivity: </span>
                  {state.vulnerability}
                </p>
              </div>
            </>
          )}

          {activeTab === 'trends' && (
            <div className="space-y-4">
              <div className="bg-[#FAFAFA] rounded-2xl p-4 border border-[#EEEEEE]">
                <h4 className="text-xs font-semibold text-black uppercase tracking-wider mb-1" style={{ fontFamily: interFont }}>
                  10-Year Historical Risk & Rainfall Trajectory (2017 - 2026)
                </h4>
                <p className="text-[11px] text-[#737373] mb-4" style={{ fontFamily: interFont }}>
                  Observed historical response to ENSO shifts, El Niño anomalies, and post-event monsoon recoveries.
                </p>

                {/* Timeline rows */}
                <div className="space-y-2">
                  {history.map((pt) => {
                    const isDeficit = pt.rainfall_deviation < 0;
                    return (
                      <div
                        key={pt.year}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EEEEEE] text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-black w-12">{pt.year}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              pt.risk_score >= 47 ? 'bg-red-100 text-red-700' : pt.risk_score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            Score: {pt.risk_score}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-[11px]">
                          <span className={`font-medium ${isDeficit ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isDeficit ? '' : '+'}{(pt.rainfall_deviation * 100).toFixed(1)}% Rain
                          </span>
                          <span className="text-[#737373]">
                            Loss: {pt.agricultural_loss_pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advisory' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">⚠️</span>
                  <h4 className="text-sm font-semibold text-amber-800" style={{ fontFamily: interFont }}>
                    Early Warning Status: {riskCat.toUpperCase()} MONITORING REQUIRED
                  </h4>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed" style={{ fontFamily: interFont }}>
                  Based on ongoing Oceanic Niño Index conditions and regional rainfall deviation ({metrics.rainfall_deviation >= 0 ? '+' : ''}{(metrics.rainfall_deviation * 100).toFixed(1)}%), {state.name} is classified in the {riskCat} risk tier.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] space-y-3">
                <h4 className="text-xs font-semibold text-black uppercase tracking-wider" style={{ fontFamily: interFont }}>
                  Recommended Agro-Climatic Action Plan
                </h4>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#FAFAFA] border-l-4 border-emerald-500">
                    <span className="font-semibold text-black block mb-0.5">1. Agricultural Contingency Crop Plan</span>
                    <p className="text-[#6F6F6F]">
                      Promote short-duration drought-tolerant varieties for major crops ({state.crops.slice(0, 2).join(', ')}). Stagger nursery sowing if monsoon onset shows delayed progress.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FAFAFA] border-l-4 border-blue-500">
                    <span className="font-semibold text-black block mb-0.5">2. Irrigation & Groundwater Rationing</span>
                    <p className="text-[#6F6F6F]">
                      Ensure micro-irrigation subsidies (drip/sprinkler) reach rainfed blocks. Prioritize canal releases for critical crop flowering and grain filling stages.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FAFAFA] border-l-4 border-amber-500">
                    <span className="font-semibold text-black block mb-0.5">3. Public Health & Supplementary Nutrition</span>
                    <p className="text-[#6F6F6F]">
                      Activate targeted Poshan Abhiyaan supplementary egg/pulse rations at Anganwadi centers in high-risk talukas to buffer children against secondary stunting lags.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        <div className="p-4 border-t border-[#F0F0F0] bg-[#FAFAFA] flex flex-col sm:flex-row gap-2">
          {onNavigateToForecast && (
            <button
              onClick={() => onNavigateToForecast(state.modelRegion)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-semibold shadow-xs hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{ fontFamily: interFont }}
            >
              <span>🔮 3-Year Post-El Niño Forecast</span>
            </button>
          )}

          {onNavigateToAnalysis && (
            <button
              onClick={() => onNavigateToAnalysis(state.modelRegion)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-black text-white text-xs font-semibold shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{ fontFamily: interFont }}
            >
              <span>🧪 Adjust ML Indicators &rarr;</span>
            </button>
          )}

          {onNavigateToCompare && (
            <button
              onClick={() => onNavigateToCompare(state.modelRegion)}
              className="py-2.5 px-3 rounded-xl border border-[#D0D0D0] text-[#333] hover:bg-white text-xs font-medium transition-all cursor-pointer"
              style={{ fontFamily: interFont }}
            >
              <span>⚖️ Compare</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
