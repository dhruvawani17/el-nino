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
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <video ref={videoRef} className="absolute w-full" style={{ top: '300px', inset: 'auto 0 0 0' }} src={VIDEO_URL} muted playsInline autoPlay />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FFFFFF] via-transparent to-[#FFFFFF]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="text-3xl tracking-tight text-[#000000]">
          <span style={{ fontFamily: "'Instrument Serif', serif" }}>El Niño</span>
          <span className="text-[#6F6F6F] ml-2 text-lg" style={{ fontFamily: "'Inter', sans-serif" }}>Risk Intelligence</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {[
            { label: 'Risk Analysis', page: 'analysis' },
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
          <button onClick={() => go('analysis')}
            className="rounded-full px-6 py-2.5 text-sm bg-[#000000] text-white transition-transform hover:scale-[1.03] cursor-pointer"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            Start Analysis
          </button>
        </div>
      </nav>

      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6" style={{ paddingTop: 'calc(8rem - 75px)', paddingBottom: '10rem' }}>
        <div className="animate-fade-rise mb-6">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium tracking-wider uppercase bg-[#000000] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
            AI-Powered Climate Intelligence
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
        <div className="flex items-center gap-4 mt-12 animate-fade-rise-delay-2">
          <button onClick={() => go('analysis')}
            className="rounded-full px-14 py-5 text-base bg-[#000000] text-white transition-transform hover:scale-[1.03] cursor-pointer"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            Run Risk Analysis
          </button>
          <button onClick={() => go('scenario')}
            className="rounded-full px-14 py-5 text-base border border-[#000000] text-[#000000] transition-all hover:bg-[#000000] hover:text-white cursor-pointer"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            Try Scenario
          </button>
        </div>
      </section>
    </div>
  );
}
