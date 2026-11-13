/**
 * Cierre de sesión que no depende de la red (sin Expo, para poder probarlo).
 * auth-js `signOut` carga la sesión antes de borrarla: sin red y con el token vencido falla
 * (para cualquier scope) sin quitar nada. Por eso las claves guardadas se borran siempre a mano.
 */
type Advertir = (mensaje: string, detalle: unknown) => void

export async function borrarSesionGuardada(
  storage: { removeItem(k: string): Promise<void> },
  clave: string,
  advertir: Advertir = (m, d) => console.warn(m, d),
): Promise<void> {
  for (const k of [clave, `${clave}-user`, `${clave}-code-verifier`, 'supabase.session']) {
    try {
      await storage.removeItem(k)
    } catch (e) {
      advertir('GC-AUTH-028: no se pudo borrar la sesión local', e)
    }
  }
}

export async function cerrarSesionYBorrar(
  cliente: { auth: { signOut(): Promise<{ error: unknown | null }> } },
  storage: { removeItem(k: string): Promise<void> },
  clave: string,
  advertir: Advertir = (m, d) => console.warn(m, d),
): Promise<void> {
  try {
    const { error } = await cliente.auth.signOut()
    if (error) advertir('GC-AUTH-027: no se pudo cerrar sesión en el servidor', error)
  } catch (e) {
    advertir('GC-AUTH-027: no se pudo cerrar sesión en el servidor', e)
  }
  await borrarSesionGuardada(storage, clave, advertir)
}
