import type { RegionMetrics } from '../../data/regionalRiskData';

interface NationalOverviewBannerProps {
  currentScenario: string;
  scenarioLabel: string;
  scenarioBadge: string;
  regionMetricsMap: Record<string, RegionMetrics>;
  onExportReport?: () => void;
}

export default function NationalOverviewBanner({
  scenarioLabel,
  scenarioBadge,
  regionMetricsMap,
  onExportReport,
}: NationalOverviewBannerProps) {
  const interFont = "'Inter', sans-serif";
  const serifFont = "'Instrument Serif', serif";

  const entries = Object.entries(regionMetricsMap);
  const count = entries.length || 1;

  // Calculate national aggregates
  const avgRisk = entries.reduce((acc, [, m]) => acc + m.risk_score, 0) / count;
  const highRiskCount = entries.filter(([, m]) => m.risk_score >= 42).length;
  
  // Find highest risk region
  let maxRegion = '';
  let maxScore = -1;
  let minRainDev = 100;
  let minRainRegion = '';

  for (const [r, m] of entries) {
    if (m.risk_score > maxScore) {
      maxScore = m.risk_score;
      maxRegion = r;
    }
    if (m.rainfall_deviation < minRainDev) {
      minRainDev = m.rainfall_deviation;
      minRainRegion = r;
    }
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#F0F0F0] shadow-[0_4px_24px_rgba(0,0,0,0.03)] mb-8">
      {/* Top Advisory Pill */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#000000]" style={{ fontFamily: interFont }}>
                India Agro-Climate Risk Command Center
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold border border-orange-200">
                {scenarioBadge}
              </span>
            </div>
            <p className="text-xs text-[#6F6F6F] mt-0.5" style={{ fontFamily: interFont }}>
              Current View: <span className="font-semibold text-[#000000]">{scenarioLabel}</span> across 40 calibrated agro-climatic sub-divisions.
            </p>
          </div>
        </div>

        {onExportReport && (
          <button
            onClick={onExportReport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#D5D5D5] hover:bg-[#F5F5F5] text-xs font-medium text-[#222] transition-colors cursor-pointer"
            style={{ fontFamily: interFont }}
          >
            <svg className="w-4 h-4 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Risk Briefing</span>
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
        <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0]">
          <span className="text-[11px] font-medium text-[#777777] uppercase tracking-wider block" style={{ fontFamily: interFont }}>
            National Avg Risk Score
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-normal text-[#000000]" style={{ fontFamily: serifFont }}>
              {avgRisk.toFixed(1)}
            </span>
            <span className="text-xs text-[#888888]">/ 100</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6F6F6F] flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${avgRisk >= 42 ? 'bg-orange-500' : 'bg-emerald-500'}`} />
            <span>{avgRisk >= 42 ? 'Elevated Alert Status' : 'Moderate Baseline'}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0]">
          <span className="text-[11px] font-medium text-[#777777] uppercase tracking-wider block" style={{ fontFamily: interFont }}>
            At-Risk Regions
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-normal text-red-600" style={{ fontFamily: serifFont }}>
              {highRiskCount}
            </span>
            <span className="text-xs text-[#888888]">/ {entries.length} States & UTs</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6F6F6F]">
            <span>Exceeding High Risk (≥ 42.0)</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0]">
          <span className="text-[11px] font-medium text-[#777777] uppercase tracking-wider block" style={{ fontFamily: interFont }}>
            Peak Vulnerability Hotspot
          </span>
          <div className="flex items-baseline gap-1 mt-1 truncate">
            <span className="text-xl font-semibold text-[#000000] truncate" style={{ fontFamily: interFont }}>
              {maxRegion || 'N/A'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-red-600 font-medium">
            <span>Score: {maxScore.toFixed(1)} / 100</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0]">
          <span className="text-[11px] font-medium text-[#777777] uppercase tracking-wider block" style={{ fontFamily: interFont }}>
            Max Monsoon Deficit
          </span>
          <div className="flex items-baseline gap-1 mt-1 truncate">
            <span className="text-xl font-semibold text-red-600 truncate" style={{ fontFamily: interFont }}>
              {(minRainDev * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-[#6F6F6F] truncate">
            <span>Most affected: {minRainRegion || 'East/Central'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
