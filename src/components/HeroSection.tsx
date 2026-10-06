import { useEffect, useRef } from 'react';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4';

interface Props {
  onNavigate?: (page: string) => void;
}

export default function HeroSection({ onNavigate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const FADE = 0.5;
    const tick = () => {
      if (!video.duration || video.paused) { requestAnimationFrame(tick); return; }
      const { currentTime: t, duration: d } = video;
      if (t < FADE) video.style.opacity = String(t / FADE);
      else if (d - t < FADE) video.style.opacity = String(Math.max(0, (d - t) / FADE));
      else video.style.opacity = '1';
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    const onEnded = () => { video.style.opacity = '0'; setTimeout(() => { video.currentTime = 0; video.play(); }, 100); };
    video.addEventListener('ended', onEnded);
    return () => { cancelAnimationFrame(raf); video.removeEventListener('ended', onEnded); };
  }, []);

  const go = (page: string) => onNavigate?.(page);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      <div className="absolute inset-0 z-0">
        <video ref={videoRef} className="absolute w-full" style={{ top: '300px', inset: 'auto 0 0 0' }} src={VIDEO_URL} muted playsInline autoPlay />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FFFFFF] via-transparent to-[#FFFFFF]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-8 py-6 max-w-7xl mx-auto">
        <div className="text-3xl tracking-tight text-[#000000]">
          <span style={{ fontFamily: "'Instrument Serif', serif" }}>El Niño</span>
          <span className="text-[#6F6F6F] ml-2 text-lg" style={{ fontFamily: "'Inter', sans-serif" }}>Risk Intelligence</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {[
            { label: 'India Risk Map', page: 'map' },
            { label: 'Risk Analysis', page: 'analysis' },
            { label: '3-Year AI Forecast', page: 'forecast' },
            { label: 'Scenario', page: 'scenario' },
            { label: 'Compare', page: 'compare' },
            { label: 'Early Warning', page: 'warning' },
          ].map((n) => (
            <button key={n.page} onClick={() => go(n.page)}
              className="text-sm text-[#6F6F6F] hover:text-[#000000] transition-colors cursor-pointer"
              style={{ fontFamily: "'Inter', sans-serif" }}>
              {n.label}
            </button>
          ))}
          <button onClick={() => go('map')}
            className="rounded-full px-5 py-2.5 text-sm bg-gradient-to-r from-orange-600 to-amber-600 text-white transition-transform hover:scale-[1.03] cursor-pointer shadow-xs flex items-center gap-1.5 font-medium"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            <span>🗺️ India Map</span>
          </button>
          <button onClick={() => go('forecast')}
            className="rounded-full px-5 py-2.5 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white transition-transform hover:scale-[1.03] cursor-pointer shadow-xs flex items-center gap-1.5 font-medium"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            <span>🔮 3-Year Outlook</span>
          </button>
          <button onClick={() => go('analysis')}
            className="rounded-full px-5 py-2.5 text-sm bg-[#000000] text-white transition-transform hover:scale-[1.03] cursor-pointer"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            Start Analysis
          </button>
        </div>
      </nav>

      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6" style={{ paddingTop: 'calc(7rem - 75px)', paddingBottom: '7rem' }}>
        <div className="animate-fade-rise mb-6">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium tracking-wider uppercase bg-[#000000] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
            AI-Powered Climate Intelligence & Geospatial Analytics
          </span>
        </div>
        <h1 className="text-5xl sm:text-7xl md:text-8xl max-w-7xl font-normal leading-[0.95] tracking-[-2.46px] animate-fade-rise" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Predict risk <span className="text-[#6F6F6F] italic">earlier.</span><br />
          Prepare before <span className="text-[#6F6F6F] italic">the crisis.</span>
        </h1>
        <p className="text-base sm:text-lg max-w-2xl mt-8 leading-relaxed text-[#6F6F6F] animate-fade-rise-delay" style={{ fontFamily: "'Inter', sans-serif" }}>
          An AI-powered early-warning platform analyzing climate, agricultural, and health data
          to identify regions facing food-security and malnutrition risks driven by El Niño events.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-10 animate-fade-rise-delay-2">
          <button onClick={() => go('map')}
            className="rounded-full px-8 py-4 text-base bg-[#000000] text-white transition-transform hover:scale-[1.03] cursor-pointer shadow-lg flex items-center gap-2"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            <span>🗺️ Explore India Risk Map</span>
          </button>
          <button onClick={() => go('analysis')}
            className="rounded-full px-8 py-4 text-base border border-[#000000] text-[#000000] transition-all hover:bg-[#000000] hover:text-white cursor-pointer"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            Run Risk Analysis
          </button>
          <button onClick={() => go('forecast')}
            className="rounded-full px-7 py-4 text-base bg-gradient-to-r from-emerald-600 to-teal-700 text-white transition-transform hover:scale-[1.03] cursor-pointer shadow-sm flex items-center gap-1.5"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            <span>🔮 3-Year Post-El Niño AI Forecast</span>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-16 text-left">
          <div
            onClick={() => go('map')}
            className="p-6 rounded-3xl bg-white/90 backdrop-blur-md border border-[#E8E8E8] hover:border-black transition-all cursor-pointer shadow-xs hover:shadow-md group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">🗺️</span>
              <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                Interactive Choropleth
              </span>
            </div>
            <h3 className="text-lg font-semibold text-black mb-1 group-hover:underline" style={{ fontFamily: "'Inter', sans-serif" }}>
              India Geospatial Risk Map
            </h3>
            <p className="text-xs text-[#6F6F6F] leading-relaxed">
              37 states & UTs visualized with precise Albers cartography. Hover for comprehensive rainfall anomalies, crop losses, and nutrition indicators.
            </p>
          </div>

          <div
            onClick={() => go('forecast')}
            className="p-6 rounded-3xl bg-white/90 backdrop-blur-md border border-[#E8E8E8] hover:border-emerald-600 transition-all cursor-pointer shadow-xs hover:shadow-md group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">🔮</span>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                AI Projections
              </span>
            </div>
            <h3 className="text-lg font-semibold text-black mb-1 group-hover:underline" style={{ fontFamily: "'Inter', sans-serif" }}>
              3-Year Post-El Niño Trajectory
            </h3>
            <p className="text-xs text-[#6F6F6F] leading-relaxed">
              Multi-year predictive modeling showing recovery timelines, lag effects on child stunting, and state-specific policy advisories for 2027-2029.
            </p>
          </div>

          <div
            onClick={() => go('warning')}
            className="p-6 rounded-3xl bg-white/90 backdrop-blur-md border border-[#E8E8E8] hover:border-red-600 transition-all cursor-pointer shadow-xs hover:shadow-md group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">⚡</span>
              <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                Early Warning Engine
              </span>
            </div>
            <h3 className="text-lg font-semibold text-black mb-1 group-hover:underline" style={{ fontFamily: "'Inter', sans-serif" }}>
              Automated Threshold Alerts
            </h3>
            <p className="text-xs text-[#6F6F6F] leading-relaxed">
              Set customized risk thresholds to immediately pinpoint critical vulnerable clusters and prioritize institutional emergency interventions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
