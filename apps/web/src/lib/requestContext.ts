export interface RequestContext {
  requestId: string
}

let last: RequestContext | null = null

export function newRequestContext(): RequestContext {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
  last = { requestId: id }
  return last
}

export function lastRequestId(): string | null {
  return last?.requestId ?? null
}

export function headersConRequestId(headers: HeadersInit | undefined, ctx: RequestContext): Headers {
  const h = new Headers(headers)
  h.set('x-request-id', ctx.requestId)
  return h
}
