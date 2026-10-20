import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oelsglmfkpzbueqysvdm.supabase.co'
export const SUPABASE_PUBLISHABLE = 'sb_publishable_-lwtjOa1ekpRv6bdjOoTmg_lL3Tmne8'

export function supabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function supabaseAsUser(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function bearer(req: Request): string {
  const header = req.headers.get('authorization') || ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}
