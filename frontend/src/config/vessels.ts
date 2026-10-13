import raw from '../../../config/vessels.json'

export interface VesselTarget {
  id: string
  label: string
  fullName?: string
  description: string
  sourceColumn: string
  positiveValue: string
  isOverall: boolean
  meshId: string
  color: string
}

export interface VesselsConfig {
  targets: VesselTarget[]
  leakageColumns: string[]
  riskColorScale: Record<string, { max: number; color: string }>
  featureGroups: Record<string, string[]>
}

export const vesselsConfig = raw as unknown as VesselsConfig

export const VESSEL_TARGETS = vesselsConfig.targets.filter((t) => !t.isOverall)
export const OVERALL_TARGET = vesselsConfig.targets.find((t) => t.isOverall)!

export function riskColor(probability: number): string {
  const p = Math.min(1, Math.max(0, probability))
  const { low, medium } = vesselsConfig.riskColorScale as Record<'low' | 'medium' | 'high', { max: number; color: string }>
  const stops: [number, string][] = [
    [0, low.color],
    [low.max, low.color],
    [(low.max + medium.max) / 2, medium.color],
    [medium.max, medium.color],
    [1, vesselsConfig.riskColorScale.high.color],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i]
    const [p1, c1] = stops[i + 1]
    if (p >= p0 && p <= p1) {
      const t = p1 === p0 ? 0 : (p - p0) / (p1 - p0)
      return lerpColor(c0, c1, t)
    }
  }
  return stops[stops.length - 1][1]
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  const r = Math.round(pa.r + (pb.r - pa.r) * t)
  const g = Math.round(pa.g + (pb.g - pa.g) * t)
  const bl = Math.round(pa.b + (pb.b - pa.b) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
