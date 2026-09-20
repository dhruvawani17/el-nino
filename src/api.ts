const API_BASE = '/api';

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

export async function getRegions() {
  return request('/regions');
}

export async function getFeatures() {
  return request('/features');
}

export async function getRegionHistory(region: string) {
  return request(`/region/${encodeURIComponent(region)}/history`);
}

export async function getModelMetrics() {
  return request('/model/metrics');
}

export async function getDatasetStats() {
  return request('/dataset/stats');
}

export async function getFeatureImportance() {
  return request('/feature-importance');
}

export async function predict(input: Record<string, unknown>) {
  return request('/predict', { method: 'POST', body: JSON.stringify(input) });
}

export async function runScenario(baseInput: Record<string, unknown>, modifications: Record<string, unknown>) {
  return request('/scenario', {
    method: 'POST',
    body: JSON.stringify({ base_input: baseInput, modifications }),
  });
}

export async function compareRegions(regions: string[], year?: number) {
  return request('/compare', {
    method: 'POST',
    body: JSON.stringify({ regions, year: year || 2024 }),
  });
}

export async function earlyWarning(threshold: number, year?: number) {
  return request('/early-warning', {
    method: 'POST',
    body: JSON.stringify({ threshold, year: year || 2024 }),
  });
}
