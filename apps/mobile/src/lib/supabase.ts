/**
 * Cliente Supabase del asesor de campo (@gc/mobile).
 * Mismas reglas que @gc/web (spec seguridad §2.3):
 * solo la anon key pública; nunca service_role en el dispositivo.
 *
 * En Expo las variables públicas se exponen como EXPO_PUBLIC_*.
 * En builds de desarrollo nativos, process.env se rellena en build time.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { BRANDING_DEMO, brandingDeJson, nombreComercial } from './branding'
import { claimsEmpresaDe, type Rol } from './claims'
import { modulosDeFilas, perfilDesdeFuentes, type Perfil } from './perfil'
import { sesionStorage } from './sesionStorage'

export { claimsDe, type Rol } from './claims'
export type { Perfil } from './perfil'

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

/**
 * Hidrata el perfil como la web: claims ya resueltos + tenant por id +
 * usuario propio si RLS lo deja ver. Un embed o .single() vacío ya no
 * bloquea el ingreso (GC-AUTH-022).
 */
export async function cargarPerfil(session: Session, claims: { tenantId: string; rol: Rol }): Promise<Perfil> {
  const userId = session.user.id
  const [usuarioRes, tenantRes, modsRes] = await Promise.all([
    supabase.from('usuario').select('id, nombre').eq('id', userId).maybeSingle(),
    supabase.from('tenant').select('id, nombre, branding').eq('id', claims.tenantId).maybeSingle(),
    supabase.from('tenant_modulo').select('activo, modulo(codigo)').eq('activo', true),
  ])
  const branding = brandingDeJson(tenantRes.data?.branding)
  return perfilDesdeFuentes({
    userId,
    claims,
    usuario: usuarioRes.data as { id: string; nombre: string } | null,
    tenantNombre: nombreComercial(branding, (tenantRes.data as { nombre?: string } | null)?.nombre ?? 'Gestiones Comerciales'),
    branding,
    modulos: modulosDeFilas(modsRes.data as Parameters<typeof modulosDeFilas>[0]),
    email: session.user.email,
    userMetadata: session.user.user_metadata,
  })
}
