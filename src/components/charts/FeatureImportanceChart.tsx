import { useEffect, useState } from 'react';

interface Feature {
  name: string;
  importance: number;
}

interface Props {
  features: Feature[];
  maxItems?: number;
}

export default function FeatureImportanceChart({ features, maxItems = 8 }: Props) {
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    let start: number;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 700, 1);
      setAnim(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [features]);

  const sorted = [...features].sort((a, b) => b.importance - a.importance).slice(0, maxItems);
  const maxImp = Math.max(...sorted.map((f) => f.importance), 0.001);

  const colors = ['#000', '#333', '#555', '#777', '#999', '#aaa', '#bbb', '#ccc'];

  return (
    <div className="space-y-2.5">
      {sorted.map((f, i) => {
        const pct = (f.importance / maxImp) * 100 * anim;
        return (
          <div key={f.name} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#6F6F6F] truncate max-w-[180px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                {f.name.replace(/_/g, ' ')}
              </span>
              <span className="text-xs font-medium text-[#000] tabular-nums" style={{ fontFamily: "'Inter', sans-serif" }}>
                {(f.importance * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${pct}%`,
                backgroundColor: colors[i % colors.length],
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
