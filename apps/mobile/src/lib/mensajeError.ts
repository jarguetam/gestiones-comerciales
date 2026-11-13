/** Mensaje legible de un error: Error, objeto de PostgREST ({ message }) o texto; si no, el respaldo. */
export function mensajeDeError(e: unknown, respaldo: string): string {
  if (typeof e === 'string' && e.trim() !== '') return e
  if (e && typeof e === 'object') {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.trim() !== '') return m
  }
  return respaldo
}
