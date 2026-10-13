import type { Config } from '@netlify/functions'
import { GLOBAL_IMPORTANCE, corsHeaders } from './_shared/models.mts'

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  return new Response(JSON.stringify(GLOBAL_IMPORTANCE), { headers: corsHeaders() })
}

export const config: Config = { path: '/api/global-importance' }
