export interface SchemaField {
  name: string
  label: string
  group: string
  type: 'number' | 'boolean' | 'categorical'
  default: string | number
  min?: number
  max?: number
  unit?: string
  options?: string[]
}

export interface Schema {
  fields: SchemaField[]
}

export interface TargetMetrics {
  target: string
  label: string
  bestModel: string
  cvScores: Record<string, { mean: number; std: number }>
  heldOut: {
    accuracy: number
    precision: number
    recall: number
    f1: number
    roc_auc: number
    n_test: number
    n_train: number
    positive_rate: number
  }
}

export interface Metrics {
  seed: number
  nSamples: number
  targets: TargetMetrics[]
}

export interface ShapItem {
  feature: string
  shapValue: number
  featureValue: number
}

export interface PredictionTarget {
  probability: number
  shap: ShapItem[]
}

export interface PredictionResponse {
  cad_prob: number
  lad_prob: number
  lcx_prob: number
  rca_prob: number
  targets: Record<string, PredictionTarget>
  featureValues: Record<string, string | number>
}

// In dev, Vite proxies /api -> `netlify dev` (see vite.config.ts). In
// production the same path is served by the Netlify Function routes.
const BASE = '/api'

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const fetchSchema = () => getJSON<Schema>('/schema')
export const fetchMetrics = () => getJSON<Metrics>('/metrics')
export const fetchGlobalImportance = () => getJSON<Record<string, { feature: string; meanAbsShap: number }[]>>('/global-importance')

export async function predict(patient: Record<string, string | number>): Promise<PredictionResponse> {
  const res = await fetch(`${BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patient),
  })
  if (!res.ok) throw new Error(`predict failed: ${res.status}`)
  return res.json()
}
