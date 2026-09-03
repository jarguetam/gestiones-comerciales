import { headersConRequestId, newRequestContext } from './requestContext.ts'

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctx = newRequestContext()
  const merged = new Headers(input instanceof Request ? input.headers : undefined)
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => merged.set(key, value))
  }
  const headers = headersConRequestId(merged, ctx)
  return fetch(input, { ...init, headers })
}
