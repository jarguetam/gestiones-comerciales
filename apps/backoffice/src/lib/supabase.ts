import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const DEMO_MODE = !SUPABASE_URL || !supabaseAnonKey

/**
 * Cliente de Supabase. En demo (preview sin .env) devolvemos un stub que
 * simula "sin sesión" para que la UI renderice sin explotar.
 * Nunca incluir service_role ni keys que no sean la anon (pública por diseño).
 */
export const supabase: SupabaseClient = DEMO_MODE
  ? ({} as SupabaseClient)
  : createClient(SUPABASE_URL!, supabaseAnonKey!)
