/**
 * Cliente Supabase del asesor de campo (@gc/mobile).
 * Mismas reglas que @gc/web (spec seguridad §2.3):
 * solo la anon key pública; nunca service_role en el dispositivo.
 *
 * En Expo las variables públicas se exponen como EXPO_PUBLIC_*.
 * En builds de desarrollo nativos, process.env se rellena en build time.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { BRANDING_DEMO, brandingDeJson, nombreComercial, type BrandingTenant } from './branding'
import { claimsEmpresaDe, type Rol } from './claims'
import { sesionStorage } from './sesionStorage'

export { claimsDe, type Rol } from './claims'

declare const process: { env: Record<string, string | undefined> }

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('GC-CFG-001: faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY')
}

/** El binario de campo siempre habla con Supabase. No hay preview demo. */
export const DEMO_MODE = false

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sesionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export interface Perfil {
  id: string
  tenantId: string
  nombre: string
  rol: Rol
  tenantNombre?: string
  modulos: string[]
  branding: BrandingTenant
}

export const PERFIL_DEMO: Perfil = {
  id: 'demo-asesor',
  tenantId: 'demo-tenant',
  nombre: 'Luisa Asesora',
  rol: 'asesor',
  tenantNombre: BRANDING_DEMO.nombre_comercial,
  modulos: ['crm', 'creditos', 'solicitudes', 'depositos', 'kilometraje'],
  branding: BRANDING_DEMO,
}

/**
 * Hidrata tenant/rol como la web: JWT + app_metadata del user,
 * refresh de sesión si faltan, y RPC tenant_id_actual / rol_actual.
 */
export async function resolverClaims(session: Session): Promise<{ tenantId: string; rol: Rol } | null> {
  let actual = session
  let claims = claimsEmpresaDe({
    accessToken: actual.access_token,
    appMetadata: actual.user.app_metadata,
  })
  if (!claims) {
    const { data } = await supabase.auth.refreshSession()
    if (data.session) {
      actual = data.session
      claims = claimsEmpresaDe({
        accessToken: actual.access_token,
        appMetadata: actual.user.app_metadata,
      })
    }
  }
  if (!claims) {
    const [tenantRes, rolRes] = await Promise.all([
      supabase.rpc('tenant_id_actual'),
      supabase.rpc('rol_actual'),
    ])
    claims = claimsEmpresaDe({
      accessToken: actual.access_token,
      appMetadata: actual.user.app_metadata,
      tenantIdDb: tenantRes.data != null ? String(tenantRes.data) : null,
      rolDb: typeof rolRes.data === 'string' ? rolRes.data : null,
    })
  }
  return claims
}

/** Carga el perfil del usuario autenticado (tabla public.usuario vía RLS). */
export async function cargarPerfil(userId: string, tenantId: string, rol: Rol): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, nombre, tenant(nombre, branding)')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  const tenant = (data as unknown as { tenant?: { nombre?: string; branding?: unknown } }).tenant
  const branding = brandingDeJson(tenant?.branding)
  const { data: mods } = await supabase.from('tenant_modulo').select('activo, modulo(codigo)').eq('activo', true)
  const modulos = ((mods ?? []) as Array<{ modulo: { codigo?: string } | { codigo?: string }[] | null }>)
    .map((row) => {
      const m = Array.isArray(row.modulo) ? row.modulo[0] : row.modulo
      return m?.codigo
    })
    .filter((c): c is string => !!c)
  return {
    id: data.id,
    tenantId,
    nombre: data.nombre,
    rol,
    tenantNombre: nombreComercial(branding, tenant?.nombre ?? 'Gestiones Comerciales'),
    modulos,
    branding,
  }
}
