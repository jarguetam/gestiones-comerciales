/**
 * Perfil de campo. La web no bloquea el login si falla el SELECT a
 * public.usuario (lee claims + tenant). El móvil devolvía GC-AUTH-022
 * porque exigía usuario + embed tenant(...) + .single().
 */
import type { BrandingTenant } from './branding'
import type { Rol } from './claims'

export interface Perfil {
  id: string
  tenantId: string
  nombre: string
  rol: Rol
  tenantNombre?: string
  modulos: string[]
  branding: BrandingTenant
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor.trim() : undefined
}

export function modulosDeFilas(
  mods: Array<{ modulo: { codigo?: string } | { codigo?: string }[] | null }> | null | undefined,
): string[] {
  return (mods ?? [])
    .map((row) => {
      const m = Array.isArray(row.modulo) ? row.modulo[0] : row.modulo
      return m?.codigo
    })
    .filter((c): c is string => !!c)
}

export function perfilDesdeFuentes(input: {
  userId: string
  claims: { tenantId: string; rol: Rol }
  usuario?: { id: string; nombre: string } | null
  tenantNombre?: string
  branding?: BrandingTenant
  modulos?: string[]
  email?: string | null
  userMetadata?: Record<string, unknown> | null
}): Perfil {
  const nombre =
    texto(input.usuario?.nombre) ??
    texto(input.userMetadata?.nombre) ??
    texto(input.userMetadata?.full_name) ??
    texto(input.email?.split('@')[0]) ??
    'Asesor'
  return {
    id: input.userId,
    tenantId: input.claims.tenantId,
    nombre,
    rol: input.claims.rol,
    tenantNombre: input.tenantNombre ?? 'Gestiones Comerciales',
    modulos: input.modulos ?? [],
    branding: input.branding ?? {},
  }
}
