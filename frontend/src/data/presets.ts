// Sample patient presets layered on top of the dataset-derived schema
// defaults (see Schema.fields[].default). Field names must match the raw
// dataset columns exactly - they're encoded server-side the same way for
// every preset.
export interface Preset {
  name: string
  description: string
  values: Record<string, string | number>
}

export const PRESETS: Preset[] = [
  {
    name: 'Low-risk baseline',
    description: 'Young, asymptomatic, normal echo and ECG.',
    values: {
      Age: 34,
      BMI: 23.5,
      'Typical Chest Pain': 0,
      Atypical: 'N',
      Nonanginal: 'N',
      Dyspnea: 'N',
      DM: 0,
      HTN: 0,
      DLP: 'N',
      'Current Smoker': 0,
      'EF-TTE': 60,
      'Region RWMA': 0,
      'St Elevation': 0,
      'St Depression': 0,
      Tinversion: 0,
      'Q Wave': 0,
      LVH: 'N',
      BBB: 'N',
      VHD: 'N',
    },
  },
  {
    name: 'Classic high-risk angina',
    description: 'Older patient, typical chest pain, reduced ejection fraction, wall-motion abnormality.',
    values: {
      Age: 68,
      BMI: 29.1,
      'Typical Chest Pain': 1,
      Atypical: 'N',
      Dyspnea: 'Y',
      DM: 1,
      HTN: 1,
      DLP: 'Y',
      'Current Smoker': 1,
      'EF-TTE': 35,
      'Region RWMA': 3,
      'St Elevation': 1,
      'St Depression': 1,
      Tinversion: 1,
      'Q Wave': 1,
      LVH: 'Y',
      BBB: 'LBBB',
      VHD: 'Moderate',
    },
  },
  {
    name: 'Borderline / mixed signals',
    description: 'Middle-aged, atypical chest pain, some risk factors, preserved EF.',
    values: {
      Age: 54,
      BMI: 27.0,
      'Typical Chest Pain': 0,
      Atypical: 'Y',
      Dyspnea: 'N',
      DM: 0,
      HTN: 1,
      DLP: 'Y',
      'Current Smoker': 0,
      'EF-TTE': 48,
      'Region RWMA': 1,
      'St Elevation': 0,
      'St Depression': 1,
      Tinversion: 0,
      'Q Wave': 0,
      LVH: 'N',
      BBB: 'N',
      VHD: 'mild',
    },
  },
]
