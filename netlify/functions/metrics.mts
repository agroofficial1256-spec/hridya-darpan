import type { Config } from '@netlify/functions'
import { METRICS, corsHeaders } from './_shared/models.mts'

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  return new Response(JSON.stringify(METRICS), { headers: corsHeaders() })
}

export const config: Config = { path: '/api/metrics' }
