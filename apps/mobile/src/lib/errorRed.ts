/** Distingue fallos de conectividad/sesión (reintentables sin gastar intentos) de rechazos del servidor. */

const PATRON_RED = /network request failed|failed to fetch|fetch failed|networkerror|timed? ?out|aborted/i
const PATRON_JWT = /jwt expired/i
const PATRON_SESION = /^GC-NET-004:/

export function esErrorTransitorio(err: unknown): boolean {
  let message = ''
  let code = ''
  let name = ''
  if (typeof err === 'string') {
    message = err
  } else if (err && typeof err === 'object') {
    const o = err as { message?: unknown; code?: unknown; name?: unknown }
    if (typeof o.message === 'string') message = o.message
    // DOMException.code es numérico; solo un código textual indica error del servidor.
    if (typeof o.code === 'string') code = o.code
    if (typeof o.name === 'string') name = o.name
  }
  if (code === 'PGRST301' || PATRON_JWT.test(message) || PATRON_SESION.test(message)) return true
  if (code !== '') return false
  return name === 'AbortError' || PATRON_RED.test(message)
}
