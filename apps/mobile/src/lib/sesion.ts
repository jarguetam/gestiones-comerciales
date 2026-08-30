import type { Session } from '@supabase/supabase-js'

export type EventoAuth =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'

export interface EstadoSesion {
  session: Session | null
}

export function reducirSesion(
  estado: EstadoSesion,
  event: string,
  session: Session | null,
): EstadoSesion {
  if (event === 'SIGNED_OUT') return { session: null }
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
    return { session }
  }
  if (event === 'USER_UPDATED' && session) return { session }
  return { session: session ?? estado.session }
}

export interface AuthSuscribible {
  auth: {
    onAuthStateChange: (
      cb: (event: string, session: Session | null) => void,
    ) => { data: { subscription: { unsubscribe: () => void } } }
  }
}

export function suscribirSesion(
  cliente: AuthSuscribible,
  onCambio: (estado: EstadoSesion, event: string) => void,
): () => void {
  let estado: EstadoSesion = { session: null }
  const { data } = cliente.auth.onAuthStateChange((event, session) => {
    estado = reducirSesion(estado, event, session)
    onCambio(estado, event)
  })
  return () => data.subscription.unsubscribe()
}
