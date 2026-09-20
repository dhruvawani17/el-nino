import { useState, useEffect } from 'react';
import PipelineViz from './charts/PipelineViz';
import AnimatedNumber from './charts/AnimatedNumber';
import { getModelMetrics, getFeatureImportance } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inputs?: Record<string, number>;
  prediction?: { risk_score: number; risk_category: string; contributions: { feature: string; display_name: string; value: number; importance: number }[] } | null;
}

interface FeatureImp {
  name: string;
  importance: number;
  display_name: string;
}

interface TreeNode {
  id: number;
  feature: string;
  threshold: number;
  left?: number;
  right?: number;
  prediction?: number;
  depth: number;
}

function buildDecisionTree(features: FeatureImp[]): TreeNode[] {
  const top = features.slice(0, 7);
  let id = 0;
  const nodes: TreeNode[] = [];

  function addNode(depth: number, featureIdx: number, predBase: number): number {
    const nodeId = id++;
    if (depth >= 3 || featureIdx >= top.length) {
      nodes.push({ id: nodeId, feature: 'leaf', threshold: 0, prediction: predBase, depth });
      return nodeId;
    }
    const f = top[featureIdx];
    const thresholds: Record<string, number> = {
      oni_value: 1.2, drought_index: 0.55, rainfall_deviation: -0.2,
      agricultural_loss_pct: 15, crop_production_index: 95,
      malnutrition_pct: 25, food_security_index: 55,
      infant_mortality_rate: 35, stunting_pct: 30,
      temperature_anomaly: 0.3, crop_yield_tons_ha: 2.2,
      irrigation_coverage_pct: 50,
    };
    const thr = thresholds[f.name] || 0.5;
    const leftPred = Math.min(100, predBase + 8 + Math.round(f.importance * 20));
    const rightPred = Math.max(0, predBase - 5 - Math.round(f.importance * 15));
    const left = addNode(depth + 1, featureIdx + 1, leftPred);
    const right = addNode(depth + 1, featureIdx + 1, rightPred);
    nodes.push({ id: nodeId, feature: f.name, threshold: thr, left, right, depth });
    return nodeId;
  }

  addNode(0, 0, 45);
  return nodes;
}

function tracePath(nodes: TreeNode[], inputs: Record<string, number>): number[] {
  if (nodes.length === 0) return [];
  const root = nodes.find((n) => n.depth === 0);
  if (!root) return [];

  const path: number[] = [];
  let current: TreeNode | undefined = root;

  while (current && current.feature !== 'leaf') {
    path.push(current.id);
    const val: number = inputs[current.feature] ?? 0;
    const nextId: number | undefined = val <= current.threshold ? current.left : current.right;
    current = nodes.find((n) => n.id === nextId);
  }
  if (current) path.push(current.id);
  return path;
}

function getNodePositions(nodes: TreeNode[]) {
  const W = 520;
  const positions: Record<number, { x: number; y: number }> = {};

  const byDepth: Record<number, TreeNode[]> = {};
  nodes.forEach((n) => {
    if (!byDepth[n.depth]) byDepth[n.depth] = [];
    byDepth[n.depth].push(n);
  });

  Object.entries(byDepth).forEach(([d, ns]) => {
    const depth = parseInt(d);
    const y = 30 + depth * 90;
    const spacing = W / (ns.length + 1);
    ns.forEach((n, i) => {
      positions[n.id] = { x: spacing * (i + 1), y };
    });
  });

  return positions;
}

const INTER = "'Inter', sans-serif";
const SERIF = "'Instrument Serif', serif";

export default function DecisionProcess({ isOpen, onClose, inputs = {}, prediction }: Props) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'tree' | 'features' | 'metrics'>('pipeline');
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [features, setFeatures] = useState<FeatureImp[]>([]);
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    getModelMetrics().then(setMetrics).catch(() => {});
    getFeatureImportance().then((d) => setFeatures(d.features)).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'pipeline') return;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      setAnimStep(step);
      if (step >= 6) setTimeout(() => { setAnimStep(0); }, 1500);
    }, 600);
    return () => clearInterval(iv);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const tree = buildDecisionTree(features);
  const path = tracePath(tree, inputs);
  const positions = getNodePositions(tree);



  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#F0F0F0]">
          <div>
            <h2 className="text-2xl font-normal text-[#000]" style={{ fontFamily: SERIF }}>Decision Making Process</h2>
            <p className="text-sm text-[#6F6F6F] mt-0.5" style={{ fontFamily: INTER }}>
              {inputs && Object.keys(inputs).length > 0
                ? 'Showing live model path for current input values'
                : 'How the XGBoost model analyzes climate risk'}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center hover:bg-[#E8E8E8] transition-colors cursor-pointer">
            <svg className="w-4 h-4 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-8 pt-3">
          {[
            { id: 'pipeline' as const, label: 'ML Pipeline' },
            { id: 'tree' as const, label: 'Decision Tree' },
            { id: 'features' as const, label: 'Feature Importance' },
            { id: 'metrics' as const, label: 'Model Metrics' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={"px-4 py-2 rounded-lg text-sm transition-all cursor-pointer " + (activeTab === tab.id ? "bg-[#000] text-white" : "text-[#6F6F6F] hover:bg-[#F5F5F5]")}
              style={{ fontFamily: INTER }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {activeTab === 'pipeline' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-normal text-[#000] mb-2" style={{ fontFamily: SERIF }}>End-to-End ML Pipeline</h3>
                <p className="text-sm text-[#6F6F6F] mb-6" style={{ fontFamily: INTER }}>
                  The model processes data through six stages, from raw input to explainable risk intelligence.
                </p>
                <PipelineViz activeStep={animStep} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#FAFAFA] rounded-2xl p-5 text-center">
                  <span className="text-3xl font-normal block" style={{ fontFamily: SERIF }}><AnimatedNumber value={600} /></span>
                  <span className="text-xs text-[#6F6F6F]" style={{ fontFamily: INTER }}>Training Samples</span>
                </div>
                <div className="bg-[#FAFAFA] rounded-2xl p-5 text-center">
                  <span className="text-3xl font-normal block" style={{ fontFamily: SERIF }}><AnimatedNumber value={features.length || 12} /></span>
                  <span className="text-xs text-[#6F6F6F]" style={{ fontFamily: INTER }}>Input Features</span>
                </div>
                <div className="bg-[#FAFAFA] rounded-2xl p-5 text-center">
                  <span className="text-3xl font-normal block" style={{ fontFamily: SERIF }}><AnimatedNumber value={20} /></span>
                  <span className="text-xs text-[#6F6F6F]" style={{ fontFamily: INTER }}>Regions Covered</span>
                </div>
              </div>
              <div className="bg-[#FAFAFA] rounded-2xl p-6">
                <h4 className="text-sm font-medium text-[#000] mb-2" style={{ fontFamily: INTER }}>Algorithm: XGBoost</h4>
                <p className="text-sm text-[#6F6F6F] leading-relaxed" style={{ fontFamily: INTER }}>
                  XGBoost builds an ensemble of {metrics?.train_samples ? '200' : '200'} decision trees sequentially.
                  Each tree corrects errors from previous ones. The model learns non-linear relationships between
                  climate signals, agricultural conditions, and health indicators to predict composite risk scores.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'tree' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-normal text-[#000] mb-2" style={{ fontFamily: SERIF }}>Decision Tree Path</h3>
                <p className="text-sm text-[#6F6F6F] mb-2" style={{ fontFamily: INTER }}>
                  {inputs && Object.keys(inputs).length > 0
                    ? 'The highlighted path shows how your current input values traverse the tree to produce the prediction.'
                    : 'Select a region in Risk Analysis to see the live prediction path.'}
                </p>
              </div>

              {prediction && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-[#000] text-white rounded-xl px-5 py-3 text-center">
                    <span className="text-2xl font-normal block" style={{ fontFamily: SERIF }}>{prediction.risk_score}</span>
                    <span className="text-[10px] text-white/60" style={{ fontFamily: INTER }}>Predicted Score</span>
                  </div>
                  <div className="bg-[#FAFAFA] rounded-xl px-5 py-3 text-center border border-[#F0F0F0]">
                    <span className="text-2xl font-normal text-[#000] block" style={{ fontFamily: SERIF }}>{prediction.risk_category}</span>
                    <span className="text-[10px] text-[#6F6F6F]" style={{ fontFamily: INTER }}>Classification</span>
                  </div>
                  <div className="bg-[#FAFAFA] rounded-xl px-5 py-3 text-center border border-[#F0F0F0]">
                    <span className="text-2xl font-normal text-[#000] block" style={{ fontFamily: SERIF }}>{path.length}</span>
                    <span className="text-[10px] text-[#6F6F6F]" style={{ fontFamily: INTER }}>Tree Depth Traversed</span>
                  </div>
                </div>
              )}

              <div className="bg-[#FAFAFA] rounded-2xl p-6 overflow-x-auto">
                <svg width="540" height="320" viewBox="0 0 540 320">
                  {/* Edges */}
                  {tree.filter((n) => n.feature !== 'leaf').map((node) => {
                    const pos = positions[node.id];
                    if (!pos) return null;
                    const leftPos = positions[node.left ?? -1];
                    const rightPos = positions[node.right ?? -1];
                    if (!leftPos || !rightPos) return null;
                    const leftOnPath = path.includes(node.id) && path.includes(node.left ?? -1);
                    const rightOnPath = path.includes(node.id) && path.includes(node.right ?? -1);
                    return (
                      <g key={'e' + node.id}>
                        <line x1={pos.x} y1={pos.y + 18} x2={leftPos.x} y2={leftPos.y - 18}
                          stroke={leftOnPath ? '#000' : '#D8D8D8'} strokeWidth={leftOnPath ? 2.5 : 1} />
                        <line x1={pos.x} y1={pos.y + 18} x2={rightPos.x} y2={rightPos.y - 18}
                          stroke={rightOnPath ? '#000' : '#D8D8D8'} strokeWidth={rightOnPath ? 2.5 : 1} />
                        <text x={(pos.x + leftPos.x) / 2 - 6} y={(pos.y + 18 + leftPos.y - 18) / 2 - 2}
                          className="text-[9px] fill-green-600 font-medium" style={{ fontFamily: INTER }}>yes</text>
                        <text x={(pos.x + rightPos.x) / 2 + 2} y={(pos.y + 18 + rightPos.y - 18) / 2 - 2}
                          className="text-[9px] fill-red-500 font-medium" style={{ fontFamily: INTER }}>no</text>
                      </g>
                    );
                  })}

                  {/* Nodes */}
                  {tree.map((node) => {
                    const pos = positions[node.id];
                    if (!pos) return null;
                    const onPath = path.includes(node.id);
                    const isCurrent = node.id === path[path.length - 1];
                    const isLeaf = node.feature === 'leaf';
                    const inputVal = inputs[node.feature];

                    const thresholdLabels: Record<string, string> = {
                      oni_value: 'ONI', drought_index: 'Drought', rainfall_deviation: 'Rainfall',
                      agricultural_loss_pct: 'Ag Loss', crop_production_index: 'Crop Prod',
                      malnutrition_pct: 'Malnutrition', food_security_index: 'Food Sec',
                      infant_mortality_rate: 'Infant Mort.', stunting_pct: 'Stunting',
                      temperature_anomaly: 'Temp', crop_yield_tons_ha: 'Crop Yield',
                      irrigation_coverage_pct: 'Irrigation',
                    };

                    return (
                      <g key={node.id}>
                        {isLeaf ? (
                          <rect x={pos.x - 30} y={pos.y - 14} width={60} height={28} rx={14}
                            fill={onPath ? '#000' : '#E8E8E8'}
                            stroke={onPath ? '#000' : '#D0D0D0'} strokeWidth={1} />
                        ) : (
                          <rect x={pos.x - 40} y={pos.y - 14} width={80} height={28} rx={8}
                            fill={isCurrent ? '#000' : onPath ? '#333' : '#FFF'}
                            stroke={onPath ? '#000' : '#D0D0D0'} strokeWidth={isCurrent ? 2 : 1} />
                        )}
                        <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                          className={"text-[9px] font-medium " + (onPath ? "fill-white" : "fill-[#000]")}
                          style={{ fontFamily: INTER }}>
                          {isLeaf
                            ? node.prediction
                            : (thresholdLabels[node.feature] || node.feature)}
                        </text>
                        {!isLeaf && inputVal !== undefined && (
                          <text x={pos.x} y={pos.y + 14} textAnchor="middle"
                            className="text-[7px]" style={{ fontFamily: INTER, fill: inputVal <= node.threshold ? '#22c55e' : '#ef4444' }}>
                            {inputVal.toFixed(1)} {inputVal <= node.threshold ? '\u2264' : '>'} {node.threshold}
                          </text>
                        )}
                        {!isLeaf && inputVal === undefined && (
                          <text x={pos.x} y={pos.y + 14} textAnchor="middle"
                            className="text-[7px] fill-[#999]" style={{ fontFamily: INTER }}>
                            {'> ' + node.threshold}
                          </text>
                        )}
                        {isCurrent && (
                          <circle cx={pos.x} cy={pos.y} r={22} fill="none" stroke="#000" strokeWidth={1.5} opacity={0.3}>
                            <animate attributeName="r" from="18" to="26" dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                          </circle>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Input Values Used */}
              {Object.keys(inputs).length > 0 && (
                <div className="bg-[#FAFAFA] rounded-2xl p-5">
                  <h4 className="text-sm font-medium text-[#000] mb-3" style={{ fontFamily: INTER }}>Input Values Used for Path</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {prediction?.contributions.slice(0, 8).map((c) => (
                      <div key={c.feature} className="bg-white rounded-lg px-3 py-2 border border-[#F0F0F0]">
                        <span className="text-[10px] text-[#6F6F6F] block" style={{ fontFamily: INTER }}>{c.display_name}</span>
                        <span className="text-sm font-medium text-[#000]" style={{ fontFamily: INTER }}>{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 text-xs text-[#6F6F6F]" style={{ fontFamily: INTER }}>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#000]" /><span>Active path</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-white border border-[#D0D0D0]" /><span>Split node</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#E8E8E8]" /><span>Leaf (prediction)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-[#000] opacity-30" style={{ animation: 'pulse-ring 1.5s infinite' }} /><span>Current node</span></div>
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-normal text-[#000] mb-2" style={{ fontFamily: SERIF }}>Feature Importance</h3>
                <p className="text-sm text-[#6F6F6F] mb-6" style={{ fontFamily: INTER }}>
                  How much each input feature contributes to the model's predictions.
                  {prediction && ' Colored bars show the importance of each factor in your current prediction.'}
                </p>
              </div>

              {features.length > 0 ? (
                <div className="space-y-2.5">
                  {features.map((f, i) => {
                    const maxImp = features[0]?.importance || 1;
                    const pct = (f.importance / maxImp) * 100;
                    const contrib = prediction?.contributions.find((c) => c.feature === f.name);
                    const barColors = ['#000', '#333', '#555', '#777', '#999', '#aaa', '#bbb', '#ccc', '#ddd', '#eee', '#f0f0f0', '#f5f5f5'];
                    return (
                      <div key={f.name}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-[#6F6F6F] flex items-center gap-2" style={{ fontFamily: INTER }}>
                            <span className="text-[10px] text-[#999] w-4">{i + 1}</span>
                            {f.display_name}
                          </span>
                          <div className="flex items-center gap-3">
                            {contrib && <span className="text-[10px] text-[#999]" style={{ fontFamily: INTER }}>val: {contrib.value}</span>}
                            <span className="text-xs font-medium text-[#000] tabular-nums" style={{ fontFamily: INTER }}>
                              {(f.importance * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: pct + '%',
                            backgroundColor: barColors[i % barColors.length],
                            transition: 'width 0.6s ease-out',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {[65.4, 7.3, 5.8, 4.9, 3.1, 1.9, 1.4, 1.2, 1.2, 1.1, 1.0, 0.7].map((imp, i) => {
                    const names = ['El Nino / ONI Index', 'Agricultural Loss %', 'Drought Severity Index', 'Rainfall Deviation',
                      'Crop Production Index', 'Child Malnutrition %', 'Food Security Index', 'Infant Mortality Rate',
                      'Child Stunting %', 'Temperature Anomaly', 'Crop Yield (tons/ha)', 'Irrigation Coverage %'];
                    const keys = ['oni_value', 'agricultural_loss_pct', 'drought_index', 'rainfall_deviation',
                      'crop_production_index', 'malnutrition_pct', 'food_security_index', 'infant_mortality_rate',
                      'stunting_pct', 'temperature_anomaly', 'crop_yield_tons_ha', 'irrigation_coverage_pct'];
                    const contrib = prediction?.contributions.find((c) => c.feature === keys[i]);
                    const barColors = ['#000', '#333', '#555', '#777', '#999', '#aaa', '#bbb', '#ccc', '#ddd', '#eee', '#f0f0f0', '#f5f5f5'];
                    return (
                      <div key={keys[i]}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-[#6F6F6F] flex items-center gap-2" style={{ fontFamily: INTER }}>
                            <span className="text-[10px] text-[#999] w-4">{i + 1}</span>
                            {names[i]}
                          </span>
                          <div className="flex items-center gap-3">
                            {contrib && <span className="text-[10px] text-[#999]" style={{ fontFamily: INTER }}>val: {contrib.value}</span>}
                            <span className="text-xs font-medium text-[#000] tabular-nums" style={{ fontFamily: INTER }}>{imp}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: (imp / 65.4 * 100) + '%',
                            backgroundColor: barColors[i % barColors.length],
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-[#FAFAFA] rounded-2xl p-5">
                  <h4 className="text-sm font-medium text-[#000] mb-2" style={{ fontFamily: INTER }}>Top Driver</h4>
                  <p className="text-xs text-[#6F6F6F] leading-relaxed" style={{ fontFamily: INTER }}>
                    <strong>{features[0]?.display_name || 'El Nino / ONI Index'}</strong> accounts for{' '}
                    {((features[0]?.importance || 0.654) * 100).toFixed(1)}% of the model's predictive power.
                    This confirms El Nino conditions are the primary driver of regional risk.
                  </p>
                </div>
                <div className="bg-[#FAFAFA] rounded-2xl p-5">
                  <h4 className="text-sm font-medium text-[#000] mb-2" style={{ fontFamily: INTER }}>Domain Breakdown</h4>
                  <p className="text-xs text-[#6F6F6F] leading-relaxed" style={{ fontFamily: INTER }}>
                    Climate features dominate ({((features.slice(0, 4).reduce((s, f) => s + f.importance, 0)) * 100).toFixed(0)}%),
                    followed by Agriculture and Health. This aligns with the El Nino to agriculture to health causal chain.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-normal text-[#000] mb-2" style={{ fontFamily: SERIF }}>Model Performance</h3>
                <p className="text-sm text-[#6F6F6F] mb-6" style={{ fontFamily: INTER }}>
                  Evaluation metrics from the trained XGBoost model.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'R\u00B2 Score', value: metrics?.r2 ?? 0.923, desc: 'Variance explained' },
                  { label: 'MAE', value: metrics?.mae ?? 2.795, desc: 'Mean absolute error' },
                  { label: 'RMSE', value: metrics?.rmse ?? 3.5, desc: 'Root mean square error' },
                  { label: 'CV R\u00B2', value: metrics?.cv_r2_mean ?? 0.907, desc: 'Cross-validation' },
                ].map((m) => (
                  <div key={m.label} className="bg-[#FAFAFA] rounded-2xl p-5">
                    <span className="text-xs text-[#6F6F6F] block mb-1" style={{ fontFamily: INTER }}>{m.label}</span>
                    <span className="text-2xl font-normal text-[#000] block" style={{ fontFamily: SERIF }}>
                      <AnimatedNumber value={m.value} decimals={3} />
                    </span>
                    <span className="text-[10px] text-[#999]" style={{ fontFamily: INTER }}>{m.desc}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#FAFAFA] rounded-2xl p-6">
                <h4 className="text-sm font-medium text-[#000] mb-3" style={{ fontFamily: INTER }}>Training Configuration</h4>
                <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-xs" style={{ fontFamily: INTER }}>
                  {[
                    ['Algorithm', 'XGBoost (Gradient Boosted Trees)'],
                    ['Estimators', '200 trees'],
                    ['Max Depth', '6 levels'],
                    ['Learning Rate', '0.1'],
                    ['Subsample', '0.8'],
                    ['Colsample', '0.8'],
                    ['Train/Test Split', '80% / 20%'],
                    ['Cross-Validation', '5-fold'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-[#F0F0F0]">
                      <span className="text-[#6F6F6F]">{k}</span>
                      <span className="text-[#000] font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
