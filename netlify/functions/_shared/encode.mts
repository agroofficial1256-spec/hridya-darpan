// Mirrors backend/ml/preprocess.py's encode_features(), using the single
// encoding config in /config/vessels.json so both runtimes agree.
import vesselsConfig from '../../../config/vessels.json' with { type: 'json' }

type Encoding = typeof vesselsConfig.encoding

const encoding = vesselsConfig.encoding as Encoding

export type RawPatient = Record<string, string | number | boolean | undefined>

/** Encodes raw form values into the same named numeric columns the Python
 * preprocessor produces (before scaling). Column order does not matter here;
 * the model runtime looks values up by name against each model's own
 * `featureNames` list. */
export function encodeFeatures(raw: RawPatient): Record<string, number> {
  const out: Record<string, number> = {}
  const { sex, bbb, vhd } = encoding.specialColumns

  for (const [key, value] of Object.entries(raw)) {
    if (key === sex) {
      out['Sex_Male'] = (encoding.sexMap as Record<string, number>)[String(value)] ?? 0
    } else if (key === bbb) {
      for (const cat of encoding.bbbCategories) {
        out[`BBB_${cat}`] = String(value) === cat ? 1 : 0
      }
    } else if (key === vhd) {
      out['VHD_severity'] = (encoding.vhdMap as Record<string, number>)[String(value)] ?? 0
    } else if (typeof value === 'string' && value in encoding.yesNoMap) {
      out[key] = (encoding.yesNoMap as Record<string, number>)[value]
    } else {
      const n = typeof value === 'number' ? value : Number(value)
      out[key] = Number.isFinite(n) ? n : 0
    }
  }
  return out
}
