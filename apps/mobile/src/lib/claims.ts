/**
 * Claims de empresa: GoTrue los guarda en app_metadata; el hook
 * custom_access_token también puede copiarlos a la raíz del JWT.
 *
 * El decoder anterior (percent-encoding + decodeURIComponent) lanzaba
 * "URI malformed" en JWTs reales y el login móvil devolvía GC-AUTH-021
 * aunque la web, con el mismo usuario, sí entraba.
 */
export type Rol = 'admin' | 'gerente' | 'supervisor' | 'asesor'

export interface ClaimsEmpresa {
  tenantId: string
  rol: Rol
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined
}

function esRol(valor: string | undefined): valor is Rol {
  return valor === 'admin' || valor === 'gerente' || valor === 'supervisor' || valor === 'asesor'
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function payloadDeJwt(accessToken: string): Record<string, unknown> | null {
  const partes = accessToken.split('.')
  if (partes.length !== 3) return null
  try {
    return JSON.parse(base64UrlDecode(partes[1])) as Record<string, unknown>
  } catch {
    return null
  }
}

interface ClaimsParcial {
  tenantId?: string
  rol?: string
}

function claimsDePayload(payload: Record<string, unknown> | null | undefined): ClaimsParcial {
  if (!payload) return {}
  const meta =
    payload.app_metadata && typeof payload.app_metadata === 'object'
      ? (payload.app_metadata as Record<string, unknown>)
      : {}
  return {
    tenantId: texto(payload.tenant_id) ?? texto(meta.tenant_id),
    rol: texto(payload.rol) ?? texto(meta.rol),
  }
}

function cerrar(parcial: ClaimsParcial): ClaimsEmpresa | null {
  if (!parcial.tenantId || !esRol(parcial.rol)) return null
  return { tenantId: parcial.tenantId, rol: parcial.rol }
}

/** Decodifica tenant_id y rol del access token (spec F0.3). */
export function claimsDe(accessToken: string): ClaimsEmpresa | null {
  return cerrar(claimsDePayload(payloadDeJwt(accessToken)))
}

/**
 * Misma prioridad que @gc/web: session.user.app_metadata, luego JWT,
 * luego RPCs tenant_id_actual / rol_actual si el token aún no trae claims.
 */
export function claimsEmpresaDe(input: {
  accessToken?: string | null
  appMetadata?: Record<string, unknown> | null
  tenantIdDb?: string | null
  rolDb?: string | null
}): ClaimsEmpresa | null {
  const fromMeta: ClaimsParcial = {
    tenantId: texto(input.appMetadata?.tenant_id),
    rol: texto(input.appMetadata?.rol),
  }
  const fromJwt = input.accessToken ? claimsDePayload(payloadDeJwt(input.accessToken)) : {}
  return cerrar({
    tenantId: fromMeta.tenantId ?? fromJwt.tenantId ?? texto(input.tenantIdDb),
    rol: fromMeta.rol ?? fromJwt.rol ?? texto(input.rolDb),
  })
}
