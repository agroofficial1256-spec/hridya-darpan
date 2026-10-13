import { riskColor } from '../config/vessels'

interface Props {
  label: string
  fullName?: string
  probability: number
  selected: boolean
  onClick: () => void
}

export default function VesselCard({ label, fullName, probability, selected, onClick }: Props) {
  const color = riskColor(probability)
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition ${
        selected ? 'border-accent-500 bg-ink-800' : 'border-white/5 bg-ink-900 hover:border-white/15'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-mono text-sm" style={{ color }}>
          {(probability * 100).toFixed(0)}%
        </span>
      </div>
      {fullName && <span className="text-[10px] text-slate-500">{fullName}</span>}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full transition-all" style={{ width: `${probability * 100}%`, background: color }} />
      </div>
    </button>
  )
}
