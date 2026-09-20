import { useEffect, useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  maxValue?: number;
}

interface Props {
  data: DataPoint[];
  size?: number;
}

export default function RadarChart({ data, size = 240 }: Props) {
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    let start: number;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / 600, 1);
      setAnim(1 - Math.pow(1 - progress, 3));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [data]);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 30;
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const getPoint = (i: number, val: number) => {
    const maxVal = data[i].maxValue || 100;
    const ratio = (val / maxVal) * anim;
    const angle = startAngle + i * angleStep;
    return { x: cx + r * ratio * Math.cos(angle), y: cy + r * ratio * Math.sin(angle) };
  };

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1].map((pct) => {
    const points = Array.from({ length: n }, (_, i) => {
      const angle = startAngle + i * angleStep;
      return `${cx + r * pct * Math.cos(angle)},${cy + r * pct * Math.sin(angle)}`;
    }).join(' ');
    return <polygon key={pct} points={points} fill="none" stroke="#E8E8E8" strokeWidth={0.5} />;
  });

  // Axis lines
  const axes = Array.from({ length: n }, (_, i) => {
    const angle = startAngle + i * angleStep;
    const ex = cx + r * Math.cos(angle);
    const ey = cy + r * Math.sin(angle);
    return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="#E8E8E8" strokeWidth={0.5} />;
  });

  // Data polygon
  const dataPoints = data.map((d, i) => {
    const p = getPoint(i, d.value);
    return `${p.x},${p.y}`;
  }).join(' ');

  // Labels
  const labels = data.map((d, i) => {
    const angle = startAngle + i * angleStep;
    const lx = cx + (r + 22) * Math.cos(angle);
    const ly = cy + (r + 22) * Math.sin(angle);
    const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
    return (
      <text key={i} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
        className="text-[9px] fill-[#6F6F6F]" style={{ fontFamily: "'Inter', sans-serif" }}>
        {d.label}
      </text>
    );
  });

  // Dots
  const dots = data.map((d, i) => {
    const p = getPoint(i, d.value);
    return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#000" />;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings}
      {axes}
      <polygon points={dataPoints} fill="rgba(0,0,0,0.06)" stroke="#000" strokeWidth={1.5} />
      {dots}
      {labels}
    </svg>
  );
}
