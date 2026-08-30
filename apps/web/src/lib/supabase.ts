import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { apiFetch } from './api.ts'
import { credencialesPublicasValidas } from './supabaseEnv.ts'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const BACKEND_CONFIGURADO = credencialesPublicasValidas(supabaseUrl, supabaseAnonKey)
export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseAnonKey

/**
 * Cliente de Supabase. Stub solo si no hay URL+anon reales.
 * Nunca incluir service_role ni keys que no sean la anon (pública por diseño).
 */
export const supabase: SupabaseClient = BACKEND_CONFIGURADO
  ? createClient(supabaseUrl!, supabaseAnonKey!, { global: { fetch: apiFetch } })
  : ({} as SupabaseClient)
