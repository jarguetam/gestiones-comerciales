const CODIGO = /\b(GC-[A-Z]+-\d{3})\b/

export function extraerCodigoGc(texto: string): string | null {
  const m = texto.match(CODIGO)
  return m ? m[1] : null
}

/** Mensaje humano para toast: texto + código GC-* si existe. Sin catálogo i18n todavía. */
export function mensajeToast(err: unknown): { titulo: string; descripcion?: string } {
  const crudo =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'No se pudo completar la acción'
  const codigo = extraerCodigoGc(crudo)
  if (!codigo) return { titulo: crudo }
  const humano = crudo.replace(CODIGO, '').replace(/^[:\s—-]+/, '').replace(/[:\s—-]+$/, '').trim()
  return {
    titulo: humano || 'No se pudo completar la acción',
    descripcion: codigo,
  }
}
