export interface FirmaStroke {
  activo: boolean
}

export function startStroke(state: FirmaStroke): void {
  state.activo = true
}

export function endStroke(state: FirmaStroke): void {
  state.activo = false
}

/** pointercancel: aborta el trazo en curso y no lo confirma. */
export function cancelStroke(state: FirmaStroke): void {
  state.activo = false
}
