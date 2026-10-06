import type { IndiaStateFeature } from '../../data/indiaMapData';
import type { RegionMetrics } from '../../data/regionalRiskData';
import { getRiskCategory, getRiskColorClass } from '../../data/regionalRiskData';

interface IndiaMapTooltipProps {
  state: IndiaStateFeature;
  metrics: RegionMetrics;
  x: number;
  y: number;
  activeMetric: string;
}

export default function IndiaMapTooltip({
  state,
  metrics,
  x,
  y,
  activeMetric,
}: IndiaMapTooltipProps) {
  const riskCat = getRiskCategory(metrics.risk_score);
  const colorClass = getRiskColorClass(riskCat);

  const interFont = "'Inter', sans-serif";
  const serifFont = "'Instrument Serif', serif";

  const rainDevPercent = (metrics.rainfall_deviation * 100).toFixed(1);
  const isRainDeficit = metrics.rainfall_deviation < 0;

  // Smart tooltip positioning: keep within container boundaries
  const tooltipWidth = 320;
  const offsetX = x > 480 ? -tooltipWidth - 18 : 18;
  const clampedY = Math.max(10, Math.min(y - 120, 620));

  return (
    <div
      className="pointer-events-none absolute z-50 transition-all duration-75 ease-out select-none"
      style={{
        left: `${x + offsetX}px`,
        top: `${clampedY}px`,
        width: `${tooltipWidth}px`,
      }}
    >
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-[#E8E8E8] text-left">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#F0F0F0]">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A8A8A]" style={{ fontFamily: interFont }}>
                {state.zone} Zone • {state.capital}
              </span>
            </div>
            <h4
              className="text-xl font-normal text-[#111111] leading-tight flex items-center gap-2"
              style={{ fontFamily: serifFont }}
            >
              {state.name}
              <span className="text-xs font-mono font-medium text-[#888888] px-1.5 py-0.5 bg-[#F5F5F5] rounded">
                {state.code}
              </span>
            </h4>
          </div>

          <div className="flex flex-col items-end">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${colorClass.bg} ${colorClass.text} ${colorClass.border}`}
              style={{ fontFamily: interFont }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: colorClass.fill }}
              />
              {riskCat} Risk
            </span>
          </div>
        </div>

        {/* Primary Risk Gauge Bar */}
        <div className="py-2.5 border-b border-[#F0F0F0]">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] font-medium text-[#6F6F6F]" style={{ fontFamily: interFont }}>
              Composite Risk Score
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-normal text-[#111111]" style={{ fontFamily: serifFont }}>
                {metrics.risk_score.toFixed(1)}
              </span>
              <span className="text-[10px] text-[#888888]">/100</span>
            </div>
          </div>
          <div className="h-2 w-full bg-[#EEEEEE] rounded-full overflow-hidden p-[1px]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (metrics.risk_score / 65) * 100)}%`,
                backgroundColor: colorClass.fill,
              }}
            />
          </div>
        </div>

        {/* Multi-Sector Core Indicators Grid */}
        <div className="grid grid-cols-3 gap-2 py-2.5 text-center border-b border-[#F0F0F0]">
          {/* Climate */}
          <div className={`p-1.5 rounded-lg ${activeMetric === 'rainfall_deviation' || activeMetric === 'drought_index' ? 'bg-[#000000]/5 ring-1 ring-[#000000]/20' : 'bg-[#FAFAFA]'}`}>
            <span className="block text-[9px] font-medium uppercase tracking-wider text-[#888888]" style={{ fontFamily: interFont }}>
              Monsoon Dev.
            </span>
            <span
              className={`text-xs font-semibold ${isRainDeficit ? 'text-red-600' : 'text-emerald-600'}`}
              style={{ fontFamily: interFont }}
            >
              {isRainDeficit ? '' : '+'}{rainDevPercent}%
            </span>
            <span className="block text-[8px] text-[#999999] mt-0.5">
              Drought: {metrics.drought_index.toFixed(2)}
            </span>
          </div>

          {/* Agriculture */}
          <div className={`p-1.5 rounded-lg ${activeMetric === 'agricultural_loss_pct' ? 'bg-[#000000]/5 ring-1 ring-[#000000]/20' : 'bg-[#FAFAFA]'}`}>
            <span className="block text-[9px] font-medium uppercase tracking-wider text-[#888888]" style={{ fontFamily: interFont }}>
              Ag Loss %
            </span>
            <span className="text-xs font-semibold text-[#111111]" style={{ fontFamily: interFont }}>
              {metrics.agricultural_loss_pct.toFixed(1)}%
            </span>
            <span className="block text-[8px] text-[#999999] mt-0.5">
              Yield: {metrics.crop_yield_tons_ha.toFixed(1)} t/ha
            </span>
          </div>

          {/* Health & Mortality */}
          <div className={`p-1.5 rounded-lg ${activeMetric === 'malnutrition_pct' || activeMetric === 'infant_mortality_rate' ? 'bg-[#000000]/5 ring-1 ring-[#000000]/20' : 'bg-[#FAFAFA]'}`}>
            <span className="block text-[9px] font-medium uppercase tracking-wider text-[#888888]" style={{ fontFamily: interFont }}>
              Malnutrition
            </span>
            <span className="text-xs font-semibold text-amber-700" style={{ fontFamily: interFont }}>
              {metrics.malnutrition_pct.toFixed(1)}%
            </span>
            <span className="block text-[8px] text-[#999999] mt-0.5">
              IMR: {metrics.infant_mortality_rate.toFixed(0)}/1k
            </span>
          </div>
        </div>

        {/* Vulnerability Driver */}
        <div className="pt-2 text-[10px] text-[#6F6F6F] leading-relaxed" style={{ fontFamily: interFont }}>
          <span className="font-semibold text-[#333333]">Vulnerability: </span>
          {state.vulnerability}
        </div>

        {/* Crops badges */}
        <div className="mt-2 flex flex-wrap gap-1 items-center">
          <span className="text-[9px] text-[#999999] mr-1">Crops:</span>
          {state.crops.slice(0, 3).map((crop) => (
            <span
              key={crop}
              className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#4B5563]"
            >
              {crop}
            </span>
          ))}
          {state.crops.length > 3 && (
            <span className="text-[8px] text-[#999999]">+{state.crops.length - 3}</span>
          )}
        </div>

        {/* Interactive Click Prompt */}
        <div className="mt-3 pt-2 border-t border-[#F0F0F0] flex items-center justify-between text-[10px] text-[#000000] font-medium" style={{ fontFamily: interFont }}>
          <span>Click state to inspect dossier</span>
          <span className="text-[#6F6F6F]">&rarr;</span>
        </div>
      </div>
    </div>
  );
}
