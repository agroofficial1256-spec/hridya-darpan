import { useState } from 'react'
import type { Schema } from '../lib/api'
import { vesselsConfig } from '../config/vessels'
import { PRESETS } from '../data/presets'

interface Props {
  schema: Schema
  values: Record<string, string | number>
  onChange: (name: string, value: string | number) => void
  onApplyPreset: (values: Record<string, string | number>) => void
}

const GROUP_LABELS: Record<string, string> = {
  demographics: 'Demographics',
  history: 'Medical history',
  vitals: 'Vitals & exam',
  symptoms: 'Symptoms',
  ecg: 'ECG findings',
  labs: 'Lab values',
  echo: 'Echocardiography',
  other: 'Other',
}

export default function PatientForm({ schema, values, onChange, onApplyPreset }: Props) {
  const [openGroup, setOpenGroup] = useState<string>('demographics')
  const groups = Object.keys(vesselsConfig.featureGroups)

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Sample patients</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              title={preset.description}
              onClick={() => onApplyPreset(preset.values)}
              className="rounded-full border border-white/10 bg-ink-800 px-2.5 py-1 text-[11px] text-slate-300 hover:border-accent-500 hover:text-accent-400"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {groups.map((group) => {
        const fields = schema.fields.filter((f) => f.group === group)
        if (fields.length === 0) return null
        const isOpen = openGroup === group
        return (
          <div key={group} className="rounded-lg border border-white/5 bg-ink-900">
            <button
              onClick={() => setOpenGroup(isOpen ? '' : group)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-200"
            >
              {GROUP_LABELS[group] ?? group}
              <span className="text-slate-500">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-2.5 px-3 pb-3">
                {fields.map((field) => (
                  <FieldInput key={field.name} field={field} value={values[field.name]} onChange={(v) => onChange(field.name, v)} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Schema['fields'][number]
  value: string | number | undefined
  onChange: (v: string | number) => void
}) {
  const label = field.unit ? `${field.label} (${field.unit})` : field.label

  if (field.type === 'number') {
    return (
      <label className="col-span-1 flex flex-col gap-1 text-[11px] text-slate-400">
        {label}
        <input
          type="number"
          className="range-input rounded border border-white/10 bg-ink-800 px-2 py-1 text-slate-100"
          value={value ?? field.default}
          min={field.min}
          max={field.max}
          step="any"
          onChange={(e) => onChange(e.target.value === '' ? field.default : Number(e.target.value))}
        />
      </label>
    )
  }

  if (field.type === 'boolean') {
    const current = value ?? field.default
    const isYes = current === 1 || current === 'Y'
    return (
      <label className="col-span-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        {label}
        <button
          type="button"
          onClick={() => onChange(isYes ? (typeof field.default === 'string' ? 'N' : 0) : typeof field.default === 'string' ? 'Y' : 1)}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            isYes ? 'bg-risk-high/20 text-risk-high' : 'bg-ink-700 text-slate-400'
          }`}
        >
          {isYes ? 'YES' : 'NO'}
        </button>
      </label>
    )
  }

  return (
    <label className="col-span-1 flex flex-col gap-1 text-[11px] text-slate-400">
      {label}
      <select
        className="rounded border border-white/10 bg-ink-800 px-2 py-1 text-slate-100"
        value={value ?? field.default}
        onChange={(e) => onChange(e.target.value)}
      >
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}
