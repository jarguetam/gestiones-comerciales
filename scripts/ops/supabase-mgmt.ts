const SECRET = /(token|secret|key|authorization|service_role|password)/i

export function requireToken(env: NodeJS.ProcessEnv): string {
  const t = env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!t) throw new Error('GC-OPS-001: falta SUPABASE_ACCESS_TOKEN')
  return t
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET.test(k)
          ? typeof v === 'string' && v.startsWith('Bearer ')
            ? 'Bearer [redacted]'
            : '[redacted]'
          : redact(v),
      ]),
    )
  }
  return value
}

export async function getJson(
  url: string,
  token: string,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  return { status: res.status, body }
}
