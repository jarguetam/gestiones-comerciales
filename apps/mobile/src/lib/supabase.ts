/**
 * Cliente Supabase del asesor de campo (@gc/mobile).
 * Mismas reglas que @gc/web (spec seguridad §2.3):
 * solo la anon key pública; nunca service_role en el dispositivo.
 *
 * En Expo las variables públicas se exponen como EXPO_PUBLIC_*.
 * En builds de desarrollo nativos, process.env se rellena en build time.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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

export const DEMO_MODE = !supabaseUrl || !supabaseAnonKey

export const supabase: SupabaseClient = DEMO_MODE
  ? ({} as SupabaseClient)
  : createClient(supabaseUrl!, supabaseAnonKey!)

export type Rol = 'admin' | 'gerente' | 'supervisor' | 'asesor'

export interface Perfil {
  id: string
  tenantId: string
  nombre: string
  rol: Rol
  tenantNombre?: string
}

/** Decodifica los claims custom del JWT (tenant_id y rol, spec F0.3). */
export function claimsDe(accessToken: string): { tenantId: string; rol: Rol } | null {
  const partes = accessToken.split('.')
  if (partes.length !== 3) return null
  try {
    const payload = JSON.parse(base64UrlDecode(partes[1]))
    if (!payload.tenant_id || !payload.rol) return null
    return { tenantId: payload.tenant_id, rol: payload.rol }
  } catch {
    return null
  }
}

/** Carga el perfil del usuario autenticado (tabla public.usuario vía RLS). */
export async function cargarPerfil(userId: string, tenantId: string, rol: Rol): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, nombre, tenant(nombre)')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  const tenant = (data as unknown as { tenant?: { nombre?: string } }).tenant
  return {
    id: data.id,
    tenantId,
    nombre: data.nombre,
    rol,
    tenantNombre: tenant?.nombre,
  }
}
