import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { credencialesPublicasValidas } from './supabaseEnv'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const BACKEND_CONFIGURADO = credencialesPublicasValidas(SUPABASE_URL, supabaseAnonKey)

/**
 * Cliente de Supabase. Stub solo si no hay URL+anon reales.
 * Nunca incluir service_role ni keys que no sean la anon (pública por diseño).
 */
export const supabase: SupabaseClient = BACKEND_CONFIGURADO
  ? createClient(SUPABASE_URL!, supabaseAnonKey!)
  : ({} as SupabaseClient)
