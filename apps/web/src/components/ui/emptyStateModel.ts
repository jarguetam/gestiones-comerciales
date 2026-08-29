export interface EmptyStateModel {
  titulo: string
  descripcion?: string
  ctaEtiqueta?: string
}

/** Contrato de EmptyState: título obligatorio; CTA opcional pero recomendado en listados. */
export function emptyStateValido(m: EmptyStateModel): boolean {
  return typeof m.titulo === 'string' && m.titulo.trim().length > 0
}

export const EMPTY_STATE_ROOT =
  'rounded-lg border border-line bg-surface px-5 py-10 text-center'
