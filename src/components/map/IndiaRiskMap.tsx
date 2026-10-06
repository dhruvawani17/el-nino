import { useState, useMemo, useRef } from 'react';
import { INDIA_STATES, INDIA_MAP_VIEWBOX, type IndiaStateFeature } from '../../data/indiaMapData';
import {
  LATEST_REGION_DATA_2026,
  SCENARIO_DATA,
  SCENARIO_META,
  getChoroplethColor,
  type RegionMetrics,
} from '../../data/regionalRiskData';
import IndiaMapTooltip from './IndiaMapTooltip';
import StateDossierDrawer from './StateDossierDrawer';

export type MapMetricType =
  | 'risk_score'
  | 'rainfall_deviation'
  | 'drought_index'
  | 'agricultural_loss_pct'
  | 'malnutrition_pct'
  | 'food_security_index'
  | 'infant_mortality_rate';

interface MetricOption {
  id: MapMetricType;
  label: string;
  unit: string;
  lowLabel: string;
  highLabel: string;
}

const METRIC_OPTIONS: MetricOption[] = [
  { id: 'risk_score', label: 'Composite Risk Score', unit: '/100', lowLabel: 'Low Risk (≤32)', highLabel: 'Critical (≥50)' },
  { id: 'rainfall_deviation', label: 'Monsoon Rainfall Deficit', unit: '%', lowLabel: 'Normal / Excess', highLabel: 'Severe Deficit' },
  { id: 'drought_index', label: 'Drought Severity Index', unit: '', lowLabel: 'Mild (<0.35)', highLabel: 'Extreme (>0.75)' },
  { id: 'agricultural_loss_pct', label: 'Agricultural Economic Loss', unit: '%', lowLabel: '<10% Loss', highLabel: '>18% Severe Loss' },
  { id: 'malnutrition_pct', label: 'Child Malnutrition Rate', unit: '%', lowLabel: '<29% Moderate', highLabel: '>35% Acute' },
  { id: 'food_security_index', label: 'Food Insecurity', unit: '', lowLabel: 'Secure (>80)', highLabel: 'Insecure (<65)' },
  { id: 'infant_mortality_rate', label: 'Infant Mortality (IMR)', unit: '/1k', lowLabel: '<38 per 1k', highLabel: '>45 per 1k' },
];

const ZONES = ['All India', 'Northern', 'Western', 'Central', 'Eastern', 'Southern', 'North-Eastern'];

interface IndiaRiskMapProps {
  initialState?: string;
  onSelectRegion?: (regionName: string) => void;
  onNavigateToForecast?: (regionName: string) => void;
  onNavigateToAnalysis?: (regionName: string) => void;
  onNavigateToCompare?: (regionName: string) => void;
  compact?: boolean;
}

export default function IndiaRiskMap({
  initialState,
  onSelectRegion,
  onNavigateToForecast,
  onNavigateToAnalysis,
  onNavigateToCompare,
  compact = false,
}: IndiaRiskMapProps) {
  const [activeMetric, setActiveMetric] = useState<MapMetricType>('risk_score');
  const [activeScenario, setActiveScenario] = useState<string>('2026');
  const [selectedZone, setSelectedZone] = useState<string>('All India');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredState, setHoveredState] = useState<IndiaStateFeature | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedState, setSelectedState] = useState<IndiaStateFeature | null>(() => {
    if (initialState) {
      return INDIA_STATES.find(s => s.name.toLowerCase() === initialState.toLowerCase() || s.modelRegion.toLowerCase() === initialState.toLowerCase()) || null;
    }
    return null;
  });
  const [showDossier, setShowDossier] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const interFont = "'Inter', sans-serif";

  // Active scenario dataset
  const currentScenarioData = useMemo(() => {
    return SCENARIO_DATA[activeScenario] || LATEST_REGION_DATA_2026;
  }, [activeScenario]);

  // Resolve metrics for any state
  const getStateMetrics = (state: IndiaStateFeature): RegionMetrics => {
    const data = currentScenarioData[state.modelRegion] || LATEST_REGION_DATA_2026[state.modelRegion];
    if (data) return data;
    return {
      year: 2026,
      oni_value: 1.8,
      rainfall_deviation: 0.05,
      temperature_anomaly: 0.05,
      drought_index: 0.5,
      crop_production_index: 100,
      crop_yield_tons_ha: 2.5,
      agricultural_loss_pct: 12.0,
      irrigation_coverage_pct: 60.0,
      malnutrition_pct: 28.0,
      food_security_index: 80.0,
      infant_mortality_rate: 35.0,
      stunting_pct: 30.0,
      risk_score: 35.0,
    };
  };

  const handleMouseMove = (e: React.MouseEvent, state: IndiaStateFeature) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoveredState(state);
    setTooltipPos({ x, y });
  };

  const handleMouseLeave = () => {
    setHoveredState(null);
  };

  const handleStateClick = (state: IndiaStateFeature) => {
    setSelectedState(state);
    setShowDossier(true);
    onSelectRegion?.(state.modelRegion);
  };

  // Filtered states for search dropdown
  const filteredSearchStates = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return INDIA_STATES.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.capital.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const activeMetricMeta = useMemo(() => {
    return METRIC_OPTIONS.find(m => m.id === activeMetric) || METRIC_OPTIONS[0];
  }, [activeMetric]);

  return (
    <div className="relative w-full">
      {/* Controls Bar (Only on full view) */}
      {!compact && (
        <div className="space-y-4 mb-6">
          {/* Top row: Metric Selector Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]" style={{ fontFamily: interFont }}>
                Active Map Metric
              </span>
              <span className="text-xs text-[#888888]" style={{ fontFamily: interFont }}>
                Visualizing: <strong className="text-[#000000]">{activeMetricMeta.label}</strong>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-1 bg-[#F5F5F5] rounded-2xl border border-[#EEEEEE]">
              {METRIC_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMetric(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeMetric === m.id
                      ? 'bg-[#000000] text-white shadow-xs font-semibold'
                      : 'text-[#6F6F6F] hover:text-[#000000] hover:bg-white'
                  }`}
                  style={{ fontFamily: interFont }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Second row: Scenario and Zone filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Scenario Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#737373] font-medium" style={{ fontFamily: interFont }}>Scenario:</span>
              <div className="flex items-center gap-1">
                {SCENARIO_META.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setActiveScenario(sc.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                      activeScenario === sc.id
                        ? 'bg-[#000000] text-white font-semibold'
                        : 'bg-[#F3F4F6] text-[#555] hover:bg-[#E5E7EB] hover:text-[#000000]'
                    }`}
                    style={{ fontFamily: interFont }}
                    title={sc.desc}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zone Filter & Search */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Find state (e.g. Bihar, MH)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 text-xs bg-white border border-[#E0E0E0] rounded-xl px-3 py-1.5 text-[#000000] focus:outline-hidden focus:border-[#000000]"
                  style={{ fontFamily: interFont }}
                />
                {filteredSearchStates.length > 0 && searchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E0E0] rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredSearchStates.map((st) => (
                      <button
                        key={st.id}
                        onClick={() => {
                          setSelectedState(st);
                          setSearchQuery('');
                          setShowDossier(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] flex items-center justify-between cursor-pointer"
                        style={{ fontFamily: interFont }}
                      >
                        <span className="font-medium text-[#000000]">{st.name}</span>
                        <span className="text-[10px] text-[#888]">{st.zone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reset Zoom */}
              {zoomLevel !== 1 && (
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2.5 py-1 rounded-lg bg-[#EEE] text-xs text-[#555] hover:text-[#000000] cursor-pointer"
                  style={{ fontFamily: interFont }}
                >
                  Reset Zoom
                </button>
              )}
            </div>
          </div>

          {/* Zone Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-[#737373] uppercase tracking-wider shrink-0 mr-1" style={{ fontFamily: interFont }}>
              Zones:
            </span>
            {ZONES.map((zone) => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] transition-all cursor-pointer shrink-0 ${
                  selectedZone === zone
                    ? 'bg-[#000000] text-white font-semibold'
                    : 'bg-[#F2F2F2] text-[#666] hover:text-[#000000] hover:bg-[#EAEAEA]'
                }`}
                style={{ fontFamily: interFont }}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Map Rendering Container */}
      <div
        ref={containerRef}
        className="relative w-full bg-white rounded-3xl p-4 sm:p-6 border border-[#F0F0F0] shadow-[0_4px_30px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col items-center"
      >
        {/* Floating Zoom Controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 bg-white/90 backdrop-blur-md rounded-xl p-1 shadow-md border border-[#E8E8E8]">
          <button
            onClick={() => setZoomLevel(z => Math.min(1.6, z + 0.15))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F0F0F0] text-[#000000] font-bold cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => setZoomLevel(z => Math.max(0.85, z - 0.15))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F0F0F0] text-[#000000] font-bold cursor-pointer"
            title="Zoom Out"
          >
            -
          </button>
        </div>

        {/* The SVG India Map */}
        <div
          className="w-full max-w-[780px] transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center 40%' }}
        >
          <svg
            viewBox={INDIA_MAP_VIEWBOX}
            className="w-full h-auto select-none"
            style={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.04))' }}
          >
            <defs>
              <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* State Path Elements */}
            {INDIA_STATES.map((state) => {
              const metrics = getStateMetrics(state);
              const metricVal = metrics[activeMetric];
              const fillColor = getChoroplethColor(activeMetric, metricVal);
              const isSelected = selectedState?.id === state.id;
              const isHovered = hoveredState?.id === state.id;
              const inZone = selectedZone === 'All India' || state.zone === selectedZone;

              return (
                <g key={state.id} className="transition-all duration-150">
                  <path
                    d={state.d}
                    fill={fillColor}
                    fillOpacity={inZone ? (isHovered ? 0.95 : 0.85) : 0.22}
                    stroke={isSelected ? '#000000' : isHovered ? '#1E293B' : '#FFFFFF'}
                    strokeWidth={isSelected ? 3.0 : isHovered ? 2.2 : 0.9}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="cursor-pointer transition-all duration-150"
                    style={{
                      transform: isHovered ? 'scale(1.002)' : 'scale(1)',
                      transformOrigin: `${state.center[0]}px ${state.center[1]}px`,
                      filter: isSelected ? 'url(#map-glow)' : undefined,
                    }}
                    onMouseMove={(e) => handleMouseMove(e, state)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleStateClick(state)}
                  />

                  {/* Centroid Code Label & Micro Risk Dot */}
                  {inZone && (
                    <g
                      className="pointer-events-none select-none transition-opacity duration-200"
                      opacity={isHovered ? 1 : 0.85}
                    >
                      <circle
                        cx={state.center[0]}
                        cy={state.center[1]}
                        r={isSelected ? 4.5 : 3.0}
                        fill={isSelected ? '#000000' : '#FFFFFF'}
                        stroke="#000000"
                        strokeWidth={1}
                      />
                      <text
                        x={state.center[0]}
                        y={state.center[1] + 10}
                        textAnchor="middle"
                        className="text-[9px] font-mono font-bold tracking-tighter"
                        fill="#1E293B"
                        style={{
                          textShadow: '0 1px 3px rgba(255,255,255,0.9), 0 0 2px #fff',
                        }}
                      >
                        {state.code}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Information Tooltip */}
        {hoveredState && (
          <IndiaMapTooltip
            state={hoveredState}
            metrics={getStateMetrics(hoveredState)}
            x={tooltipPos.x}
            y={tooltipPos.y}
            activeMetric={activeMetric}
          />
        )}

        {/* Bottom Legend */}
        <div className="w-full max-w-lg mt-6 pt-4 border-t border-[#F0F0F0] flex flex-col items-center">
          <div className="flex items-center justify-between w-full text-[11px] font-medium text-[#737373] mb-1.5" style={{ fontFamily: interFont }}>
            <span>{activeMetricMeta.lowLabel}</span>
            <span className="text-[#000000] font-semibold">{activeMetricMeta.label}</span>
            <span>{activeMetricMeta.highLabel}</span>
          </div>

          {/* Color Gradient Scale */}
          <div className="w-full h-3 rounded-full overflow-hidden shadow-inner flex">
            {activeMetric === 'risk_score' && (
              <>
                <div className="flex-1 bg-[#10B981]" title="Low Risk (<32)" />
                <div className="flex-1 bg-[#A3E635]" title="Mild Exposure" />
                <div className="flex-1 bg-[#FBBF24]" title="Moderate Risk" />
                <div className="flex-1 bg-[#F97316]" title="High Risk" />
                <div className="flex-1 bg-[#EA580C]" title="Very High" />
                <div className="flex-1 bg-[#DC2626]" title="Critical Risk (≥50)" />
              </>
            )}
            {activeMetric === 'rainfall_deviation' && (
              <>
                <div className="flex-1 bg-[#DC2626]" title="Severe Deficit (<-25%)" />
                <div className="flex-1 bg-[#F97316]" title="Deficit (-15% to -25%)" />
                <div className="flex-1 bg-[#FBBF24]" title="Mild Deficit (-5% to -15%)" />
                <div className="flex-1 bg-[#34D399]" title="Normal (-5% to +10%)" />
                <div className="flex-1 bg-[#06B6D4]" title="Surplus (>+10%)" />
              </>
            )}
            {activeMetric !== 'risk_score' && activeMetric !== 'rainfall_deviation' && (
              <>
                <div className="flex-1 bg-[#10B981]" title="Low / Favorable" />
                <div className="flex-1 bg-[#34D399]" title="Moderate" />
                <div className="flex-1 bg-[#FBBF24]" title="Elevated" />
                <div className="flex-1 bg-[#F97316]" title="High" />
                <div className="flex-1 bg-[#DC2626]" title="Acute Stress" />
              </>
            )}
          </div>
          <p className="text-[10px] text-[#888888] mt-2 text-center" style={{ fontFamily: interFont }}>
            Hover over any state to inspect all multi-sector climate, agricultural, and nutrition indicators. Click to open deep-dive dossier.
          </p>
        </div>
      </div>

      {/* Selected State Deep-Dive Dossier Drawer */}
      {selectedState && showDossier && (
        <StateDossierDrawer
          state={selectedState}
          metrics={getStateMetrics(selectedState)}
          onClose={() => setShowDossier(false)}
          onNavigateToAnalysis={(reg) => {
            setShowDossier(false);
            onNavigateToAnalysis?.(reg);
          }}
          onNavigateToForecast={(reg) => {
            setShowDossier(false);
            onNavigateToForecast?.(reg);
          }}
          onNavigateToCompare={(reg) => {
            setShowDossier(false);
            onNavigateToCompare?.(reg);
          }}
        />
      )}
    </div>
  );
}
