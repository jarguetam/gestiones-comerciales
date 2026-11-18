/**
 * Cambio de contraseña obligatorio (primer ingreso). Funciones puras, sin React
 * ni Supabase: es copia de la de la web (`apps/web/src/features/auth/cambioClave.ts`); mantener ambas iguales.
 */

const MSG_CORTA = 'GC-AUTH-034: la contraseña debe tener al menos 8 caracteres'
const MSG_NO_COINCIDEN = 'GC-AUTH-035: las contraseñas no coinciden'
const MSG_IGUAL = 'GC-AUTH-036: la contraseña nueva debe ser distinta de la temporal'
const MSG_SIN_RED = 'GC-AUTH-037: sin conexión; no se pudo cambiar la contraseña'
const MSG_GENERICO = 'GC-AUTH-038: no se pudo cambiar la contraseña'

/** `true` solo si `app_metadata.debe_cambiar_clave` es el booleano `true`. */
export function debeCambiarClave(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  return user?.app_metadata?.debe_cambiar_clave === true
}

export function validarClaveNueva(nueva: string, confirmar: string): string | null {
  if (nueva.length < 8) return MSG_CORTA
  if (nueva !== confirmar) return MSG_NO_COINCIDEN
  return null
}

export function mensajeErrorCambioClave(
  error: { code?: string; name?: string; message?: string; status?: number } | null | undefined,
): string {
  if (!error) return MSG_GENERICO
  if (error.code === 'same_password') return MSG_IGUAL
  if (error.code === 'weak_password') return MSG_CORTA
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || error instanceof TypeError) {
    return MSG_SIN_RED
  }
  return MSG_GENERICO
}

export function decidirCambioClave(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined,
): 'liberar' | 'pedir' {
  return debeCambiarClave(user) ? 'pedir' : 'liberar'
}
