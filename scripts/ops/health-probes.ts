export type ProbeKind = 'pages' | 'auth-guard' | 'postgrest'

export function htmlContainsDemoBoard(html: string): boolean {
  return html.includes('Entrar al tablero')
}

export function probeOk(input: { kind: ProbeKind; status: number }): boolean {
  if (input.status >= 500) return false
  if (input.kind === 'pages') return input.status === 200
  if (input.kind === 'auth-guard') return input.status === 400 || input.status === 401
  return input.status < 500
}

export type ProbeResult = {
  name: string
  ok: boolean
  status: number
  requestId: string
  detail?: string
}

export async function runPagesProbe(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeResult> {
  const requestId = crypto.randomUUID()
  const res = await fetchImpl(url, { headers: { 'x-request-id': requestId } })
  const html = await res.text()
  const demo = htmlContainsDemoBoard(html)
  const ok = probeOk({ kind: 'pages', status: res.status }) && !demo
  return {
    name: `pages:${url}`,
    ok,
    status: res.status,
    requestId,
    detail: demo ? 'HTML contiene Entrar al tablero' : undefined,
  }
}
