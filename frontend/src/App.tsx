import { useEffect, useMemo, useRef, useState } from 'react'
import DisclaimerBanner from './components/DisclaimerBanner'
import Scene3D from './components/Scene3D'
import Legend from './components/Legend'
import VesselCard from './components/VesselCard'
import PatientForm from './components/PatientForm'
import ShapChart from './components/ShapChart'
import { OVERALL_TARGET, VESSEL_TARGETS, riskColor } from './config/vessels'
import { fetchSchema, predict, type PredictionResponse, type Schema } from './lib/api'

function defaultsFromSchema(schema: Schema): Record<string, string | number> {
  const values: Record<string, string | number> = {}
  for (const f of schema.fields) values[f.name] = f.default
  return values
}

export default function App() {
  const [schema, setSchema] = useState<Schema | null>(null)
  const [values, setValues] = useState<Record<string, string | number>>({})
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [selected, setSelected] = useState<string>('cad')
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchSchema()
      .then((s) => {
        setSchema(s)
        setValues(defaultsFromSchema(s))
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (!schema || Object.keys(values).length === 0) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      predict(values)
        .then(setPrediction)
        .catch((e) => setError(String(e)))
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [values, schema])

  const probabilities = useMemo(() => {
    const out: Record<string, number> = {}
    if (prediction) for (const [id, t] of Object.entries(prediction.targets)) out[id] = t.probability
    return out
  }, [prediction])

  const handleChange = (name: string, value: string | number) => setValues((v) => ({ ...v, [name]: value }))
  const handlePreset = (presetValues: Record<string, string | number>) => setValues((v) => ({ ...v, ...presetValues }))

  const selectedShap = prediction?.targets[selected]?.shap ?? []
  const cadProb = probabilities.cad ?? 0

  return (
    <div className="flex min-h-screen flex-col">
      <DisclaimerBanner />
      <header className="border-b border-white/5 px-5 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          Hridya <span className="text-accent-400">Darpan</span>
        </h1>
        <p className="text-[11px] text-slate-500">
          Cardiovascular Risk 3D Visualizer · Multimodal AI Hackathon 2026 · Track A
        </p>
      </header>

      {error && (
        <div className="mx-5 mt-3 rounded border border-red-500/30 bg-red-950/50 px-3 py-2 text-xs text-red-300">
          {error} — is the API running? See README for one-command run instructions.
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative min-h-[420px] overflow-hidden rounded-xl border border-white/5 bg-ink-900">
          <Scene3D probabilities={probabilities} selected={selected} onSelect={setSelected} />
          <Legend />
        </section>

        <section className="flex max-h-[calc(100vh-7rem)] flex-col gap-4 overflow-y-auto pr-1">
          <div
            className="rounded-xl border px-4 py-3"
            style={{ borderColor: riskColor(cadProb), background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{OVERALL_TARGET.label}</p>
                <p className="text-2xl font-bold" style={{ color: riskColor(cadProb) }}>
                  {(cadProb * 100).toFixed(1)}%
                </p>
              </div>
              <button
                onClick={() => setSelected('cad')}
                className={`rounded-full border px-3 py-1 text-[11px] ${
                  selected === 'cad' ? 'border-accent-500 text-accent-400' : 'border-white/10 text-slate-400'
                }`}
              >
                View drivers
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {VESSEL_TARGETS.map((t) => (
              <VesselCard
                key={t.id}
                label={t.label}
                fullName={t.fullName}
                probability={probabilities[t.id] ?? 0}
                selected={selected === t.id}
                onClick={() => setSelected(t.id)}
              />
            ))}
          </div>

          <div className="rounded-xl border border-white/5 bg-ink-900 p-3.5">
            <ShapChart items={selectedShap} title={`Why: ${selected.toUpperCase()} — SHAP-style drivers`} />
          </div>

          <div className="rounded-xl border border-white/5 bg-ink-900 p-3.5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Patient inputs</p>
            {schema ? (
              <PatientForm schema={schema} values={values} onChange={handleChange} onApplyPreset={handlePreset} />
            ) : (
              <p className="text-xs text-slate-500">Loading schema…</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
