import { useState } from 'react';
import HeroSection from './components/HeroSection';
import AnalysisPage from './components/AnalysisPage';
import ScenarioPage from './components/ScenarioPage';
import ComparisonPage from './components/ComparisonPage';
import EarlyWarningPage from './components/EarlyWarningPage';

type Page = 'home' | 'analysis' | 'scenario' | 'compare' | 'warning';

const NAV = [
  { id: 'home' as Page, label: 'Home' },
  { id: 'analysis' as Page, label: 'Risk Analysis' },
  { id: 'scenario' as Page, label: 'Scenario' },
  { id: 'compare' as Page, label: 'Compare' },
  { id: 'warning' as Page, label: 'Early Warning' },
];

export default function App() {
  const [page, setPage] = useState<Page>('home');

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      {page !== 'home' && (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#F0F0F0]">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-4">
            <button
              onClick={() => setPage('home')}
              className="text-xl tracking-tight text-[#000000] cursor-pointer"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              El Niño <span className="text-[#6F6F6F] text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>Risk Intelligence</span>
            </button>
            <div className="flex items-center gap-1">
              {NAV.filter(n => n.id !== 'home').map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPage(n.id)}
                  className={`px-4 py-2 rounded-full text-sm transition-all cursor-pointer ${
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
      {page === 'analysis' && <AnalysisPage />}
      {page === 'scenario' && <ScenarioPage />}
      {page === 'compare' && <ComparisonPage />}
      {page === 'warning' && <EarlyWarningPage />}
    </div>
  );
}
