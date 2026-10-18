/**
 * Talks to /api/purchase-pin. The PIN is sent once over HTTPS and is not saved here.
 */

export interface PinStatus {
  hasPin: boolean
  locked: boolean
  retryInMs: number
  resetReady: boolean
  emailVerified: boolean
}

export type PinCall = { ok: true; grant?: string } | { ok: false; reason: string }

async function postPin(token: string, body: Record<string, string>): Promise<PinCall> {
  try {
    const res = await fetch('/api/purchase-pin', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as { ok?: unknown; grant?: unknown; error?: unknown } | null
    if (!res.ok || data?.ok !== true) {
      return { ok: false, reason: typeof data?.error === 'string' ? data.error : 'Purchases are unavailable right now.' }
    }
    return { ok: true, grant: typeof data.grant === 'string' ? data.grant : undefined }
  } catch {
    return { ok: false, reason: 'Purchases are unavailable right now.' }
  }
}

export async function fetchPinStatus(token: string): Promise<PinStatus | null> {
  try {
    const res = await fetch('/api/purchase-pin', {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<PinStatus>
    return {
      hasPin: data.hasPin === true,
      locked: data.locked === true,
      retryInMs: typeof data.retryInMs === 'number' ? data.retryInMs : 0,
      resetReady: data.resetReady === true,
      emailVerified: data.emailVerified === true,
    }
  } catch {
    return null
  }
}

export function createPurchasePin(token: string, pin: string, again: string): Promise<PinCall> {
  return postPin(token, { action: 'create', pin, again })
}

export function verifyPurchasePin(token: string, pin: string): Promise<PinCall> {
  return postPin(token, { action: 'verify', pin })
}

export function forgotPurchasePin(token: string): Promise<PinCall> {
  return postPin(token, { action: 'forgot' })
}

export function resetPurchasePin(token: string, pin: string, again: string): Promise<PinCall> {
  return postPin(token, { action: 'reset', pin, again })
}

export function consumePurchasePinGrant(token: string, grant: string): Promise<PinCall> {
  return postPin(token, { action: 'consume', grant })
}
