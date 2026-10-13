export default function Legend() {
  return (
    <div className="absolute right-2 top-2 rounded-lg bg-ink-900/80 p-2.5 text-[11px] text-slate-300 ring-1 ring-white/10 backdrop-blur">
      <p className="mb-1.5 font-semibold text-slate-200">Predicted risk</p>
      <div className="h-2 w-36 rounded-full" style={{ background: 'linear-gradient(90deg, #22c55e, #eab308, #ef4444)' }} />
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  )
}
