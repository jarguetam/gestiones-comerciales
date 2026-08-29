export interface EmptyStateModel {
  titulo: string
  descripcion?: string
  ctaEtiqueta?: string
}

export function emptyStateValido(m: EmptyStateModel): boolean {
  return typeof m.titulo === 'string' && m.titulo.trim().length > 0
}

export const EMPTY_STATE_ROOT =
  'rounded-lg border border-line bg-surface px-5 py-10 text-center'
