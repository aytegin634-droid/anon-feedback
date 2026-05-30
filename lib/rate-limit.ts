import { createAdminClient } from '@/lib/supabase/admin'

type Result = { ok: true } | { ok: false; retryAfter: number }

/**
 * Возвращает ok:true если в пределах лимита, иначе ok:false + сколько ждать (сек).
 * Использует «sliding window» в таблице rate_limits.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<Result> {
  const supabase = createAdminClient()
  const now = Date.now()

  const { data: existing } = await supabase
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .maybeSingle()

  if (!existing) {
    await supabase.from('rate_limits').insert({ key, count: 1, window_start: new Date().toISOString() })
    return { ok: true }
  }

  const windowStartMs = new Date(existing.window_start).getTime()
  const elapsed = (now - windowStartMs) / 1000

  if (elapsed > windowSeconds) {
    // окно истекло, начинаем заново
    await supabase
      .from('rate_limits')
      .update({ count: 1, window_start: new Date().toISOString() })
      .eq('key', key)
    return { ok: true }
  }

  if (existing.count >= maxRequests) {
    return { ok: false, retryAfter: Math.ceil(windowSeconds - elapsed) }
  }

  await supabase
    .from('rate_limits')
    .update({ count: existing.count + 1 })
    .eq('key', key)
  return { ok: true }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}