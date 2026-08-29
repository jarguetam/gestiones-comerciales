import catalogoEs from '../locales/es/errors.json' with { type: 'json' }

const CODIGO = /\b(GC-[A-Z]+-\d{3})\b/

const CATALOGO: Record<string, string> = catalogoEs

export function extraerCodigoGc(texto: string): string | null {
  const m = texto.match(CODIGO)
  return m ? m[1] : null
}

export function mensajeCatalogo(codigo: string, idioma = 'es'): string | null {
  if (idioma !== 'es') return null
  return CATALOGO[codigo] ?? null
}

/** Mensaje humano para toast: catálogo i18n + código GC-* si existe. */
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
  const deCatalogo = mensajeCatalogo(codigo)
  const humano = crudo.replace(CODIGO, '').replace(/^[:\s—-]+/, '').replace(/[:\s—-]+$/, '').trim()
  return {
    titulo: deCatalogo || humano || 'No se pudo completar la acción',
    descripcion: codigo,
  }
}
