import { useState } from 'react';
import HeroSection from './components/HeroSection';
import AnalysisPage from './components/AnalysisPage';
import ForecastPage from './components/ForecastPage';
import ScenarioPage from './components/ScenarioPage';
import ComparisonPage from './components/ComparisonPage';
import EarlyWarningPage from './components/EarlyWarningPage';
import IndiaMapPage from './components/IndiaMapPage';

type Page = 'home' | 'map' | 'analysis' | 'forecast' | 'scenario' | 'compare' | 'warning';

const NAV = [
  { id: 'home' as Page, label: 'Home' },
  { id: 'map' as Page, label: 'India Risk Map' },
  { id: 'analysis' as Page, label: 'Risk Analysis' },
  { id: 'forecast' as Page, label: '3-Year AI Forecast' },
  { id: 'scenario' as Page, label: 'Scenario' },
  { id: 'compare' as Page, label: 'Compare' },
  { id: 'warning' as Page, label: 'Early Warning' },
];

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedForecastRegion, setSelectedForecastRegion] = useState<string>('Bihar');
  const [selectedAnalysisRegion, setSelectedAnalysisRegion] = useState<string>('Bihar');

  const navigateToForecast = (reg: string) => {
    setSelectedForecastRegion(reg);
    setPage('forecast');
  };

  const navigateToAnalysis = (reg: string) => {
    setSelectedAnalysisRegion(reg);
    setPage('analysis');
  };

  const navigateToCompare = (_reg: string) => {
    setPage('compare');
  };

  return (
    <div className="min-h-screen bg-white text-[#000000]">
      {/* Top bar */}
      {page !== 'home' && (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#F0F0F0]">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-6 sm:px-8 py-3.5">
            <button
              onClick={() => setPage('home')}
              className="text-xl tracking-tight text-[#000000] cursor-pointer flex items-center gap-2"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              <span>El Niño</span>
              <span className="text-[#6F6F6F] text-xs font-normal" style={{ fontFamily: "'Inter', sans-serif" }}>
                Risk Intelligence
              </span>
            </button>
            <div className="flex items-center gap-1 overflow-x-auto">
              {NAV.filter(n => n.id !== 'home').map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPage(n.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    page === n.id
                      ? 'bg-[#000000] text-white'
                      : 'text-[#6F6F6F] hover:text-[#000000] hover:bg-[#F5F5F5]'
                  }`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Pages */}
      {page === 'home' && <HeroSection onNavigate={(p) => setPage(p as Page)} />}
      {page === 'map' && (
        <IndiaMapPage
          onNavigateToAnalysis={navigateToAnalysis}
          onNavigateToForecast={navigateToForecast}
          onNavigateToCompare={navigateToCompare}
        />
      )}
      {page === 'analysis' && (
        <AnalysisPage
          initialRegion={selectedAnalysisRegion}
          onNavigateToForecast={navigateToForecast}
        />
      )}
      {page === 'forecast' && <ForecastPage initialRegion={selectedForecastRegion} />}
      {page === 'scenario' && <ScenarioPage />}
      {page === 'compare' && <ComparisonPage />}
      {page === 'warning' && <EarlyWarningPage />}
    </div>
  );
}
