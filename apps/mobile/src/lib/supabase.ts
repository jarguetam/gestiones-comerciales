/**
 * Cliente Supabase del asesor de campo (@gc/mobile).
 * Mismas reglas que @gc/web (spec seguridad §2.3):
 * solo la anon key pública; nunca service_role en el dispositivo.
 *
 * En Expo las variables públicas se exponen como EXPO_PUBLIC_*.
 * En builds de desarrollo nativos, process.env se rellena en build time.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BRANDING_DEMO, brandingDeJson, nombreComercial, type BrandingTenant } from './branding'
import { credencialesPublicasValidas, mensajePreviewSinBackend, varsFaltantesSupabase } from './supabaseEnv'

// Base64 URL-safe sin Buffer (Hermes no lo incluye por defecto)
function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  let bin = ''
  for (let i = 0, bc = 0, bs: string | undefined, buffer = 0, idx = 0; (bs = b64.charAt(idx++)); ) {
    buffer = chars.indexOf(bs)
    if (~buffer) {
      bc = bc % 4 ? bc * 64 + buffer : buffer
      if (bc++ % 4) bin += String.fromCharCode(255 & (bc >> ((-2 * bc) & 6)))
    }
  }
  // UTF-8 decode
  return decodeURIComponent(
    bin.split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
  )
}

declare const process: { env: Record<string, string | undefined> }

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined

export const BACKEND_CONFIGURADO = credencialesPublicasValidas(supabaseUrl, supabaseAnonKey)
export const FALTANTES_BACKEND = varsFaltantesSupabase(supabaseUrl, supabaseAnonKey)
export const MENSAJE_BACKEND = mensajePreviewSinBackend(FALTANTES_BACKEND)

/** Sin keys reales, o el asesor eligió demostración. Mutar solo desde Login. */
export let DEMO_MODE = !BACKEND_CONFIGURADO

export function activarSesionDemo() {
  DEMO_MODE = true
}

export function desactivarSesionDemo() {
  DEMO_MODE = !BACKEND_CONFIGURADO
}

export const supabase: SupabaseClient = BACKEND_CONFIGURADO
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : ({} as SupabaseClient)

export type Rol = 'admin' | 'gerente' | 'supervisor' | 'asesor'

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

/** Decodifica los claims custom del JWT (tenant_id y rol, spec F0.3). */
export function claimsDe(accessToken: string): { tenantId: string; rol: Rol } | null {
  const partes = accessToken.split('.')
  if (partes.length !== 3) return null
  try {
    const payload = JSON.parse(base64UrlDecode(partes[1])) as {
      tenant_id?: string
      rol?: Rol
      app_metadata?: { tenant_id?: string; rol?: Rol }
    }
    const tenantId = payload.tenant_id || payload.app_metadata?.tenant_id
    const rol = payload.rol || payload.app_metadata?.rol
    if (!tenantId || !rol) return null
    return { tenantId, rol }
  } catch {
    return null
  }
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
