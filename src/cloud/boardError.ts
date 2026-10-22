const UP_YET = "The board isn't up yet."

/** Short server messages only. Hide schema, permission, and address leaks. */
export function boardError(error: { message?: string } | null, fallback = UP_YET): string {
  const raw = (error?.message || '').replace(/^ERROR:\s*/i, '').trim().split('\n')[0] ?? ''
  if (!raw || /relation|function|schema|permission|jwt|email|stack|password/i.test(raw)) return fallback
  if (raw.length > 90) return fallback
  return raw
}
