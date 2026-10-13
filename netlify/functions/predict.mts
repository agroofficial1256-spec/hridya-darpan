import type { Config } from '@netlify/functions'
import { CONFIG, MODELS, SCHEMA, corsHeaders } from './_shared/models.mts'
import { encodeFeatures, type RawPatient } from './_shared/encode.mts'
import { predict as runModel } from './_shared/modelRuntime.mts'

type SchemaField = (typeof SCHEMA.fields)[number]

/** Fills in defaults and clamps numeric fields to the dataset's observed
 * range, so a partial or slightly out-of-range request still gets a sane
 * prediction instead of a crash. */
function validateAndFill(body: RawPatient): RawPatient {
  const out: RawPatient = {}
  for (const field of SCHEMA.fields as SchemaField[]) {
    const incoming = body[field.name]
    if (field.type === 'number') {
      const n = typeof incoming === 'number' ? incoming : Number(incoming)
      const f = field as Extract<SchemaField, { type: 'number' }>
      out[field.name] = Number.isFinite(n) ? Math.min(f.max, Math.max(f.min, n)) : f.default
    } else if (incoming === undefined || incoming === null || incoming === '') {
      out[field.name] = field.default
    } else {
      out[field.name] = incoming as string | number
    }
  }
  return out
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: corsHeaders() })
  }

  let body: RawPatient = {}
  try {
    body = (await req.json()) as RawPatient
  } catch {
    // empty/invalid body falls back to dataset defaults for every field
  }

  const patient = validateAndFill(body)
  const encoded = encodeFeatures(patient)

  const targets: Record<string, { probability: number; shap: { feature: string; shapValue: number; featureValue: number }[] }> = {}
  for (const t of CONFIG.targets) {
    const model = MODELS[t.id]
    if (!model) continue
    const { probability, contributions } = runModel(model, encoded)
    targets[t.id] = {
      probability,
      shap: contributions.map((c) => ({ feature: c.feature, shapValue: c.contribution, featureValue: c.featureValue })),
    }
  }

  const response = {
    cad_prob: targets.cad?.probability ?? null,
    lad_prob: targets.lad?.probability ?? null,
    lcx_prob: targets.lcx?.probability ?? null,
    rca_prob: targets.rca?.probability ?? null,
    targets,
    featureValues: patient,
  }

  return new Response(JSON.stringify(response), { headers: corsHeaders() })
}

export const config: Config = { path: '/api/predict' }
