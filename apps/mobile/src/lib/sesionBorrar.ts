/**
 * Cierre de sesión que no depende de la red (sin Expo, para poder probarlo).
 * auth-js `signOut` carga la sesión antes de borrarla: sin red y con el token vencido falla
 * (para cualquier scope) sin quitar nada. Por eso las claves guardadas se borran siempre a mano.
 */
import { intentarConLimite } from './conLimite.ts'
import { leerSesionGuardada } from './sesionSinConexion.ts'

type Advertir = (mensaje: string, detalle: unknown) => void

/** Tope de espera de cada paso de red del cierre de sesión. */
export const LIMITE_SALIDA_MS = 3_000

const MENSAJE_SIGNOUT = 'GC-AUTH-027: no se pudo cerrar sesión en el servidor'

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
  cliente: {
    auth: {
      signOut(): Promise<{ error: unknown | null }>
      admin?: { signOut(jwt: string, scope?: 'global' | 'local' | 'others'): Promise<{ error: unknown | null }> }
    }
  },
  storage: { removeItem(k: string): Promise<void>; getItem?(k: string): Promise<string | null> },
  clave: string,
  advertir: Advertir = (m, d) => console.warn(m, d),
  { limiteMs = LIMITE_SALIDA_MS, ahoraMs = Date.now }: { limiteMs?: number; ahoraMs?: () => number } = {},
): Promise<void> {
  const guardada = storage.getItem ? await leerSesionGuardada({ getItem: storage.getItem.bind(storage) }, clave, advertir) : null
  // Primero lo local: si el asesor cierra la app mientras signOut espera la red, la sesión ya no está.
  await borrarSesionGuardada(storage, clave, advertir)
  // Con el almacenamiento vacío signOut no llama a la red y emite SIGNED_OUT; el tope cubre la espera de initialize.
  await intentarConLimite(async () => {
    const { error } = await cliente.auth.signOut()
    if (error) throw error
  }, limiteMs, MENSAJE_SIGNOUT, advertir)
  // signOut ya no ve la sesión: se revoca en el servidor con el token leído antes de borrar.
  // Con el token vencido (sin señal) no se intenta; renovarlo volvería a guardar una sesión.
  const admin = cliente.auth.admin
  if (!admin || !guardada?.expires_at || guardada.expires_at * 1000 <= ahoraMs()) return
  await intentarConLimite(async () => {
    const { error } = await admin.signOut(guardada.access_token, 'global')
    // Igual que auth-js: 401/403/404 significan que el token ya no sirve en el servidor.
    const status = (error as { status?: unknown } | null)?.status
    if (error && status !== 401 && status !== 403 && status !== 404) throw error
  }, limiteMs, MENSAJE_SIGNOUT, advertir)
}
