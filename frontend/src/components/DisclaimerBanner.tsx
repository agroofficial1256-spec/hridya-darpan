export default function DisclaimerBanner() {
  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-amber-500/30 bg-amber-950/80 px-4 py-2 text-xs text-amber-200 backdrop-blur">
      <span className="text-base leading-none">⚠</span>
      <p>
        <span className="font-semibold">For decision support / educational purposes only.</span>{' '}
        Not a substitute for formal diagnostic imaging.
      </p>
    </div>
  )
}
