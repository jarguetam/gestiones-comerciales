export interface EmptyStateModel {
  titulo: string
  descripcion?: string
  ctaEtiqueta?: string
}

export function emptyStateValido(m: EmptyStateModel): boolean {
  return typeof m.titulo === 'string' && m.titulo.trim().length > 0
}

export const EMPTY_STATE_ROOT =
  'rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center'
