const CODIGO = /\b(GC-[A-Z]+-\d{3})\b/

export function extraerCodigoGc(texto: string): string | null {
  const m = texto.match(CODIGO)
  return m ? m[1] : null
}

export function formatError(
  err: unknown,
  requestId?: string,
): { message: string; code: string | null; requestId?: string } {
  const crudo =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'No se pudo completar la acción'
  const code = extraerCodigoGc(crudo)
  const message = crudo.replace(CODIGO, '').replace(/^[:\s—-]+/, '').replace(/[:\s—-]+$/, '').trim() || crudo
  return { message, code, requestId }
}
