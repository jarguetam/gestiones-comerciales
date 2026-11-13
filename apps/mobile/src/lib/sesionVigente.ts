/**
 * Sin sesión vigente (token vencido y refresh fallido, típico sin señal) supabase-js manda
 * la anon key: las RPC de campo dan 42501 y las lecturas con RLS devuelven listas vacías.
 * Antes de ir al servidor se exige sesión; si no hay, el error es transitorio (GC-NET-004),
 * así la cola espera sin gastar intentos y las pantallas usan la copia guardada.
 */

export const MENSAJE_SESION_SIN_RENOVAR = 'GC-NET-004: sesión sin renovar (sin conexión)'

export interface ClienteConSesion {
  auth: { getSession: () => Promise<{ data: { session: unknown } }> }
}

export async function exigirSesion(cliente: ClienteConSesion): Promise<void> {
  const { data } = await cliente.auth.getSession()
  if (!data.session) throw new Error(MENSAJE_SESION_SIN_RENOVAR)
}
