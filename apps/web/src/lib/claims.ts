/**
 * Claims de empresa: GoTrue los guarda en app_metadata; el hook
 * custom_access_token también puede copiarlos a la raíz del JWT.
 * La navegación W-10/W-11 no debe depender de un solo sitio.
 */

export interface ClaimsEmpresa {
  tenantId?: string
  rol?: string
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function claimsDeAccessToken(accessToken?: string | null): ClaimsEmpresa | null {
  if (!accessToken) return null
  const partes = accessToken.split('.')
  if (partes.length !== 3) return null
  try {
    const payload = JSON.parse(base64UrlDecode(partes[1])) as Record<string, unknown>
    const meta =
      payload.app_metadata && typeof payload.app_metadata === 'object'
        ? (payload.app_metadata as Record<string, unknown>)
        : {}
    const tenantId = texto(payload.tenant_id) ?? texto(meta.tenant_id)
    const rol = texto(payload.rol) ?? texto(meta.rol)
    if (!tenantId && !rol) return null
    return { tenantId, rol }
  } catch {
    return null
  }
}

export function claimsDeUsuario(
  user: { app_metadata?: Record<string, unknown> } | null | undefined,
  accessToken?: string | null,
): ClaimsEmpresa {
  const meta = user?.app_metadata ?? {}
  const fromMeta: ClaimsEmpresa = {
    tenantId: texto(meta.tenant_id),
    rol: texto(meta.rol),
  }
  if (fromMeta.tenantId && fromMeta.rol) return fromMeta
  const fromJwt = claimsDeAccessToken(accessToken)
  return {
    tenantId: fromMeta.tenantId ?? fromJwt?.tenantId,
    rol: fromMeta.rol ?? fromJwt?.rol,
  }
}

/** W-10: catálogos y branding del tenant. */
export function mostrarConfiguracion(rol: string | undefined): boolean {
  return rol === 'admin'
}

/** W-11: estructura comercial. */
export function mostrarUsuarios(rol: string | undefined): boolean {
  return rol === 'admin' || rol === 'gerente'
}

/** W-12: log de auditoría. */
export function mostrarAuditoria(rol: string | undefined): boolean {
  return rol === 'admin'
}

/** W-14: mapa de asesores (última posición + recorrido). */
export function mostrarMapa(rol: string | undefined): boolean {
  return rol === 'admin' || rol === 'gerente' || rol === 'supervisor'
}

export function canAccess(path: string, rol: string | undefined): boolean {
  if (path.startsWith('/configuracion')) return mostrarConfiguracion(rol)
  if (path.startsWith('/usuarios')) return mostrarUsuarios(rol)
  if (path.startsWith('/auditoria')) return mostrarAuditoria(rol)
  if (path.startsWith('/mapa')) return mostrarMapa(rol)
  return true
}
