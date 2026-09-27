import catalogoEs from '../locales/es/errors.json' with { type: 'json' }
import { mensajeGc } from './persistirHelpers.ts'

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

export function formatError(
  err: unknown,
  requestId?: string,
): { message: string; code: string | null; requestId?: string } {
  const t = mensajeToast(err)
  return {
    message: t.titulo,
    code: t.descripcion ?? extraerCodigoGc(t.titulo),
    requestId,
  }
}

/** Recupera el código de negocio de una respuesta HTTP fallida de Edge. */
export async function mensajeErrorEdge(err: unknown): Promise<string> {
  const context = err && typeof err === 'object' && 'context' in err
    ? (err as { context: unknown }).context
    : null
  if (context instanceof Response) {
    try {
      const body: unknown = await context.json()
      const error = body && typeof body === 'object' && 'error' in body
        ? (body as { error: unknown }).error
        : null
      if (typeof error === 'string' && /^GC-[A-Z]+-\d{3}(?::|$)/.test(error)) return error
    } catch {
      // La respuesta puede venir del gateway sin JSON; conservar el error HTTP original.
    }
  }
  return mensajeGc(err)
}
