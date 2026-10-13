import vesselsConfig from '../../../config/vessels.json' with { type: 'json' }
import schema from '../../../models/schema.json' with { type: 'json' }
import metrics from '../../../models/metrics.json' with { type: 'json' }
import cadModel from '../../../models/cad_portable.json' with { type: 'json' }
import ladModel from '../../../models/lad_portable.json' with { type: 'json' }
import lcxModel from '../../../models/lcx_portable.json' with { type: 'json' }
import rcaModel from '../../../models/rca_portable.json' with { type: 'json' }
import cadShap from '../../../models/cad_shap_global.json' with { type: 'json' }
import ladShap from '../../../models/lad_shap_global.json' with { type: 'json' }
import lcxShap from '../../../models/lcx_shap_global.json' with { type: 'json' }
import rcaShap from '../../../models/rca_shap_global.json' with { type: 'json' }
import type { PortableModel } from './modelRuntime.mts'

export const CONFIG = vesselsConfig
export const SCHEMA = schema
export const METRICS = metrics

export const MODELS: Record<string, PortableModel> = {
  cad: cadModel as PortableModel,
  lad: ladModel as PortableModel,
  lcx: lcxModel as PortableModel,
  rca: rcaModel as PortableModel,
}

export const GLOBAL_IMPORTANCE: Record<string, { feature: string; meanAbsShap: number }[]> = {
  cad: cadShap,
  lad: ladShap,
  lcx: lcxShap,
  rca: rcaShap,
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }
}
