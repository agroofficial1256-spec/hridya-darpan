import type { ShapItem } from '../lib/api'

interface Props {
  items: ShapItem[]
  title: string
}

export default function ShapChart({ items, title }: Props) {
  const maxAbs = Math.max(0.001, ...items.map((i) => Math.abs(i.shapValue)))

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="space-y-1.5">
        {items.map((item) => {
          const pct = (Math.abs(item.shapValue) / maxAbs) * 100
          const positive = item.shapValue >= 0
          return (
            <div key={item.feature} className="flex items-center gap-2 text-[11px]">
              <span className="w-32 truncate text-right text-slate-400" title={`${item.feature} (standardized value ${item.featureValue.toFixed(2)})`}>
                {item.feature}
                <span className="ml-1 text-slate-600">({item.featureValue.toFixed(1)})</span>
              </span>
              <div className="relative h-4 flex-1 rounded bg-ink-800">
                <div
                  className={`absolute top-0 h-4 rounded ${positive ? 'bg-risk-high/80' : 'bg-accent-500/80'}`}
                  style={{
                    width: `${pct / 2}%`,
                    left: positive ? '50%' : `${50 - pct / 2}%`,
                  }}
                />
                <div className="absolute left-1/2 top-0 h-4 w-px bg-slate-600" />
              </div>
              <span className={`w-14 text-right font-mono ${positive ? 'text-risk-high' : 'text-accent-400'}`}>
                {positive ? '+' : ''}
                {item.shapValue.toFixed(3)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500">
        <span className="text-risk-high">Red</span> pushes risk up, <span className="text-accent-400">teal</span> pushes risk down.
      </p>
    </div>
  )
}
