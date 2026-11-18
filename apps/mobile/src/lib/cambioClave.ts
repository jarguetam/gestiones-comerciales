/**
 * Cambio de contraseña obligatorio (primer ingreso). Funciones puras, sin React
 * ni Supabase: es copia de la de la web (`apps/web/src/features/auth/cambioClave.ts`); mantener ambas iguales.
 */

export const MSG_CLAVE_CORTA = 'GC-AUTH-034: la contraseña debe tener al menos 8 caracteres'
export const MSG_CLAVES_NO_COINCIDEN = 'GC-AUTH-035: las contraseñas no coinciden'
export const MSG_CLAVE_IGUAL = 'GC-AUTH-036: la contraseña nueva debe ser distinta de la temporal'
export const MSG_CAMBIO_SIN_RED = 'GC-AUTH-037: sin conexión; no se pudo cambiar la contraseña'
export const MSG_CAMBIO_GENERICO = 'GC-AUTH-038: no se pudo cambiar la contraseña'
/** Solo en la ruta posterior a un `updateUser` exitoso: la clave ya cambió. */
export const MSG_CAMBIO_HECHO_SIN_CONFIRMAR =
  'GC-AUTH-039: tu contraseña ya se cambió, pero no se pudo confirmar la sesión; revisa la conexión y pulsa Reintentar'

/** `true` solo si `app_metadata.debe_cambiar_clave` es el booleano `true`. */
export function debeCambiarClave(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  return user?.app_metadata?.debe_cambiar_clave === true
}

export function validarClaveNueva(nueva: string, confirmar: string): string | null {
  if (nueva.length < 8) return MSG_CLAVE_CORTA
  if (nueva !== confirmar) return MSG_CLAVES_NO_COINCIDEN
  return null
}

export function mensajeErrorCambioClave(
  error: { code?: string; name?: string; message?: string; status?: number } | null | undefined,
): string {
  if (!error) return MSG_CAMBIO_GENERICO
  if (error.code === 'same_password') return MSG_CLAVE_IGUAL
  if (error.code === 'weak_password') return MSG_CLAVE_CORTA
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || error instanceof TypeError) {
    return MSG_CAMBIO_SIN_RED
  }
  return MSG_CAMBIO_GENERICO
}

export function decidirCambioClave(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined,
): 'liberar' | 'pedir' {
  return debeCambiarClave(user) ? 'pedir' : 'liberar'
}
