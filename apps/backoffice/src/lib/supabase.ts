import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { credencialesPublicasValidas } from './supabaseEnv'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const BACKEND_CONFIGURADO = credencialesPublicasValidas(SUPABASE_URL, supabaseAnonKey)

const PREVIEW_DEMO = 'gc-preview-demo'

function previewDemoGuardado(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(PREVIEW_DEMO) === '1'
  } catch {
    return false
  }
}

export let DEMO_MODE = !BACKEND_CONFIGURADO || previewDemoGuardado()

export function activarSesionDemo() {
  DEMO_MODE = true
  try {
    sessionStorage.setItem(PREVIEW_DEMO, '1')
  } catch {
    /* ignore */
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
  ? createClient(SUPABASE_URL!, supabaseAnonKey!)
  : ({} as SupabaseClient)
