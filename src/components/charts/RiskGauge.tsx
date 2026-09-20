import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  max?: number;
  size?: number;
  label?: string;
}

export default function RiskGauge({ value, max = 100, size = 200, label }: Props) {
  const [animated, setAnimated] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = animated;
    const diff = value - start;
    const duration = 800;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimated(start + diff * ease);
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current!);
  }, [value]);

  const r = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle;
  const pct = Math.min(animated / max, 1);
  const currentAngle = startAngle + totalAngle * pct;

  const polarToCart = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const arcPath = (start: number, end: number, radius: number) => {
    const s = polarToCart(start, radius);
    const e = polarToCart(end, radius);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const color = animated < 25 ? '#22c55e' : animated < 45 ? '#f59e0b' : animated < 65 ? '#f97316' : '#ef4444';
  const category = animated < 25 ? 'Low' : animated < 45 ? 'Moderate' : animated < 65 ? 'High' : 'Critical';

  const needle = polarToCart(currentAngle, r - 8);
  const needleBase1 = polarToCart(currentAngle + 90, 4);
  const needleBase2 = polarToCart(currentAngle - 90, 4);

  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const angle = startAngle + (totalAngle * i) / 10;
    const outer = polarToCart(angle, r + 2);
    const inner = polarToCart(angle, r - 6);
    const isMajor = i % 5 === 0;
    ticks.push(
      <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
        stroke={isMajor ? '#999' : '#ccc'} strokeWidth={isMajor ? 2 : 1} />
    );
    if (isMajor) {
      const labelPos = polarToCart(angle, r + 14);
      ticks.push(
        <text key={`l${i}`} x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle"
          className="text-[9px] fill-[#999]" style={{ fontFamily: "'Inter', sans-serif" }}>
          {Math.round((max * i) / 10)}
        </text>
      );
    }
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="#E8E8E8" strokeWidth={10} strokeLinecap="round" />
        {/* Colored arc */}
        <path d={arcPath(startAngle, currentAngle, r)} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          style={{ transition: 'stroke 0.3s' }} />
        {/* Ticks */}
        {ticks}
        {/* Needle */}
        <polygon points={`${needle.x},${needle.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill="#000" />
        <circle cx={cx} cy={cy} r={5} fill="#000" />
        {/* Value */}
        <text x={cx} y={cy + 28} textAnchor="middle" className="text-2xl fill-[#000] font-normal"
          style={{ fontFamily: "'Instrument Serif', serif" }}>
          {Math.round(animated)}
        </text>
        <text x={cx} y={cy + 44} textAnchor="middle" className="text-[10px] fill-[#6F6F6F]"
          style={{ fontFamily: "'Inter', sans-serif" }}>
          {category}
        </text>
      </svg>
      {label && <span className="text-xs text-[#6F6F6F] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>{label}</span>}
    </div>
  );
}
