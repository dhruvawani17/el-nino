import { useEffect, useState } from 'react';

const STEPS = [
  { icon: '📊', label: 'Data Collection', desc: 'Climate, agriculture, health datasets' },
  { icon: '🔧', label: 'Preprocessing', desc: 'Clean, standardize, merge' },
  { icon: '⚙️', label: 'Feature Engineering', desc: '12 predictive features' },
  { icon: '🧠', label: 'XGBoost Model', desc: '200 gradient-boosted trees' },
  { icon: '📈', label: 'Risk Scoring', desc: 'Score 0-100 classification' },
  { icon: '💡', label: 'Explainability', desc: 'Feature importance breakdown' },
];

interface Props {
  activeStep?: number;
}

export default function PipelineViz({ activeStep = -1 }: Props) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (activeStep >= 0) {
      setVisible(activeStep + 1);
      return;
    }
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setVisible(step);
      if (step >= STEPS.length) {
        clearInterval(interval);
        setTimeout(() => { setVisible(0); step = 0; }, 2000);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [activeStep]);

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-4">
      {STEPS.map((step, i) => {
        const isActive = i < visible;
        const isCurrent = i === visible - 1;
        return (
          <div key={i} className="flex items-start flex-shrink-0">
            <div className={`flex flex-col items-center w-28 transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl mb-2 transition-all duration-500 ${
                isCurrent ? 'bg-[#000] shadow-lg scale-110' : isActive ? 'bg-[#000]' : 'bg-[#F0F0F0]'
              }`}>
                <span className={isCurrent ? 'animate-bounce' : ''}>{step.icon}</span>
              </div>
              <span className={`text-[11px] font-medium text-center leading-tight ${isActive ? 'text-[#000]' : 'text-[#999]'}`}
                style={{ fontFamily: "'Inter', sans-serif" }}>
                {step.label}
              </span>
              <span className="text-[9px] text-[#6F6F6F] text-center mt-0.5 leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                {step.desc}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex items-center pt-5 flex-shrink-0">
                <div className={`w-8 h-0.5 transition-all duration-500 ${i < visible - 1 ? 'bg-[#000]' : 'bg-[#E0E0E0]'}`} />
                <svg className={`w-3 h-3 transition-all duration-500 ${i < visible - 1 ? 'text-[#000]' : 'text-[#E0E0E0]'}`}
                  fill="currentColor" viewBox="0 0 12 12">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth={2} fill="none" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
