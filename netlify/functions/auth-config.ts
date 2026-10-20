import { json } from '../lib/http.ts'
import { SUPABASE_PUBLISHABLE, SUPABASE_URL } from '../lib/supabaseAdmin.ts'

/** What this deploy can offer. Missing secrets hide the button. They never block play. */
export default async function authConfig(): Promise<Response> {
  let google = false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE },
    })
    if (res.ok) {
      const data = (await res.json()) as { external?: { google?: boolean } }
      google = data.external?.google === true
    }
  } catch {
    google = false
  }
  return json({
    passkey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    google,
    vapidPublic: process.env.VAPID_PUBLIC_KEY || '',
  })
}
