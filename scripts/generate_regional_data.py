import pandas as pd, json
from pathlib import Path

df = pd.read_csv('public/model/full.csv')

# Unique regions and years
regions = sorted(df['region'].unique())

# Build 2026 data
df_2026 = df[df['year'] == 2026].set_index('region')
data_2026 = {}
for r in regions:
    if r in df_2026.index:
        row = df_2026.loc[r].to_dict()
        data_2026[r] = {k: round(float(v), 2) for k, v in row.items() if k != 'region'}

# Build key historical scenarios
scenarios_to_capture = [2026, 2023, 2015, 2021, 1997]
scenario_data = {}

for yr in scenarios_to_capture:
    df_yr = df[df['year'] == yr].set_index('region')
    scenario_data[str(yr)] = {}
    for r in regions:
        if r in df_yr.index:
            row = df_yr.loc[r].to_dict()
            scenario_data[str(yr)][r] = {k: round(float(v), 2) for k, v in row.items() if k != 'region'}

# Build historical 46-year mean
mean_df = df.groupby('region').mean()
scenario_data['baseline_avg'] = {}
for r in regions:
    if r in mean_df.index:
        row = mean_df.loc[r].to_dict()
        scenario_data['baseline_avg'][r] = {k: round(float(v), 2) for k, v in row.items() if k != 'region'}

# Build compact historical trajectory (last 10 years: 2017-2026) for sparklines
histories = {}
df_recent = df[df['year'] >= 2017].sort_values(['region', 'year'])
for r in regions:
    r_df = df_recent[df_recent['region'] == r]
    histories[r] = [
        {
            'year': int(row['year']),
            'risk_score': round(float(row['risk_score']), 1),
            'rainfall_deviation': round(float(row['rainfall_deviation']), 3),
            'drought_index': round(float(row['drought_index']), 2),
            'crop_production_index': round(float(row['crop_production_index']), 1),
            'agricultural_loss_pct': round(float(row['agricultural_loss_pct']), 1),
        }
        for _, row in r_df.iterrows()
    ]

ts_code = f"""// Auto-generated regional climate, agricultural, health & risk dataset
// Generated from historical calibrated model dataset (1981 - 2026)

export interface RegionMetrics {{
  year: number;
  oni_value: number;
  rainfall_deviation: number;
  temperature_anomaly: number;
  drought_index: number;
  crop_production_index: number;
  crop_yield_tons_ha: number;
  agricultural_loss_pct: number;
  irrigation_coverage_pct: number;
  malnutrition_pct: number;
  food_security_index: number;
  infant_mortality_rate: number;
  stunting_pct: number;
  risk_score: number;
}}

export interface RegionHistoryPoint {{
  year: number;
  risk_score: number;
  rainfall_deviation: number;
  drought_index: number;
  crop_production_index: number;
  agricultural_loss_pct: number;
}}

export const LATEST_REGION_DATA_2026: Record<string, RegionMetrics> = {json.dumps(data_2026, indent=2)};

export const SCENARIO_DATA: Record<string, Record<string, RegionMetrics>> = {json.dumps(scenario_data, indent=2)};

export const REGION_HISTORIES: Record<string, RegionHistoryPoint[]> = {json.dumps(histories, indent=2)};

export const SCENARIO_META = [
  {{ id: '2026', label: '2026 Active Forecast', badge: 'Active ONI +1.8°C', desc: 'Current model projection under ongoing moderate-to-strong El Niño conditions' }},
  {{ id: '2023', label: '2023-24 Strong El Niño', badge: 'Historic ONI +2.0°C', desc: 'High monsoon deficit across southern peninsula and central rainfed belts' }},
  {{ id: '2015', label: '2015-16 Godzilla El Niño', badge: 'Severe ONI +2.6°C', desc: 'Catastrophic back-to-back monsoon failures across Marathwada and Bundelkhand' }},
  {{ id: '2021', label: '2021 La Niña Recovery', badge: 'Favorable ONI -1.0°C', desc: 'Above-normal monsoon precipitation and buoyant agricultural kharif harvest' }},
  {{ id: 'baseline_avg', label: '46-Year Climatological Average', badge: 'Long-term Mean', desc: 'Multi-decadal baseline risk exposure without ENSO extreme shocks' }},
];

export function getRiskCategory(score: number): 'Low' | 'Moderate' | 'High' | 'Critical' {{
  if (score >= 50.0) return 'Critical';
  if (score >= 42.0) return 'High';
  if (score >= 32.0) return 'Moderate';
  return 'Low';
}}

export function getRiskColorClass(cat: string): {{ bg: string; text: string; border: string; glow: string; fill: string }} {{
  switch (cat) {{
    case 'Critical':
      return {{
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        glow: 'rgba(239, 68, 68, 0.4)',
        fill: '#EF4444'
      }};
    case 'High':
      return {{
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        glow: 'rgba(249, 115, 22, 0.4)',
        fill: '#F97316'
      }};
    case 'Moderate':
      return {{
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        glow: 'rgba(245, 158, 11, 0.4)',
        fill: '#F59E0B'
      }};
    case 'Low':
    default:
      return {{
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        glow: 'rgba(16, 185, 129, 0.4)',
        fill: '#10B981'
      }};
  }}
}}

export function getChoroplethColor(metric: string, val: number): string {{
  if (metric === 'risk_score') {{
    if (val >= 50.0) return '#DC2626'; // Deep Red
    if (val >= 47.0) return '#EA580C'; // Bright Orange
    if (val >= 44.0) return '#F97316'; // Orange
    if (val >= 40.0) return '#FBBF24'; // Amber
    if (val >= 33.0) return '#A3E635'; // Lime
    return '#10B981';                  // Emerald Green
  }}
  if (metric === 'rainfall_deviation') {{
    // Negative = Deficit (Red/Orange), Positive = Surplus (Green/Cyan)
    if (val <= -0.25) return '#DC2626'; // Severe Deficit
    if (val <= -0.15) return '#F97316'; // Deficit
    if (val <= -0.05) return '#FBBF24'; // Mild Deficit
    if (val <= 0.10) return '#34D399';  // Normal
    return '#06B6D4';                   // Excess
  }}
  if (metric === 'drought_index') {{
    if (val >= 0.75) return '#DC2626';
    if (val >= 0.65) return '#F97316';
    if (val >= 0.50) return '#FBBF24';
    if (val >= 0.35) return '#34D399';
    return '#10B981';
  }}
  if (metric === 'agricultural_loss_pct') {{
    if (val >= 18.0) return '#DC2626';
    if (val >= 16.0) return '#EA580C';
    if (val >= 14.0) return '#F59E0B';
    if (val >= 10.0) return '#34D399';
    return '#10B981';
  }}
  if (metric === 'malnutrition_pct') {{
    if (val >= 35.0) return '#DC2626';
    if (val >= 32.0) return '#EA580C';
    if (val >= 29.0) return '#F59E0B';
    return '#10B981';
  }}
  if (metric === 'food_security_index') {{
    // Higher is better for security, lower is more insecure
    if (val <= 65) return '#DC2626';
    if (val <= 72) return '#F97316';
    if (val <= 80) return '#FBBF24';
    return '#10B981';
  }}
  if (metric === 'infant_mortality_rate') {{
    if (val >= 45.0) return '#DC2626';
    if (val >= 42.0) return '#F97316';
    if (val >= 38.0) return '#FBBF24';
    return '#10B981';
  }}
  return '#10B981';
}}
"""

out_path = Path('src/data/regionalRiskData.ts')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(ts_code)

print(f"Generated regionalRiskData.ts ({len(ts_code)} bytes)")
