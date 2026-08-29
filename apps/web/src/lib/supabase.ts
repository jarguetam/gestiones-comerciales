import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { credencialesPublicasValidas } from './supabaseEnv'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const BACKEND_CONFIGURADO = credencialesPublicasValidas(supabaseUrl, supabaseAnonKey)
export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseAnonKey

const PREVIEW_DEMO = 'gc-preview-demo'

function previewDemoGuardado(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(PREVIEW_DEMO) === '1'
  } catch {
    return false
  }
}

/**
 * DEMO_MODE: sin credenciales públicas, o el usuario eligió demostración
 * aunque el cliente de Supabase exista (Pages live). Es `let` a propósito:
 * el login demo tiene que poder entrar sin JWT.
 */
export let DEMO_MODE = !BACKEND_CONFIGURADO || previewDemoGuardado()

export function activarSesionDemo() {
  DEMO_MODE = true
  try {
    sessionStorage.setItem(PREVIEW_DEMO, '1')
  } catch {
    /* SSR / storage bloqueado */
  }
}

export function desactivarSesionDemo() {
  DEMO_MODE = !BACKEND_CONFIGURADO
  try {
    sessionStorage.removeItem(PREVIEW_DEMO)
  } catch {
    /* ignore */
  }
}

/**
 * Cliente de Supabase. Stub solo si no hay URL+anon reales.
 * Nunca incluir service_role ni keys que no sean la anon (pública por diseño).
 */
export const supabase: SupabaseClient = BACKEND_CONFIGURADO
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : ({} as SupabaseClient)
