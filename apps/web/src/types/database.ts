/**
 * Tipos Supabase versionados (Gate 1 / Task 15).
 * Regenerar con: supabase gen types typescript --linked > apps/web/src/types/database.ts
 * Gate 2 cableará diff en CI.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tenant: {
        Row: {
          id: string
          codigo: string
          nombre: string
          rubro: string
          plan: string
          branding: Json
          configuracion: Json
          activo: boolean
        }
        Insert: Partial<Database['public']['Tables']['tenant']['Row']>
        Update: Partial<Database['public']['Tables']['tenant']['Row']>
      }
      usuario: {
        Row: {
          id: string
          tenant_id: string
          email: string
          nombre: string
          rol: string
          activo: boolean
        }
        Insert: Partial<Database['public']['Tables']['usuario']['Row']>
        Update: Partial<Database['public']['Tables']['usuario']['Row']>
      }
      config_rastreo: {
        Row: {
          id: number
          tenant_id: string
          dia_semana: number
          hora_inicio: string
          hora_fin: string
          intervalo_min: number
          precision_max_m: number
        }
        Insert: Partial<Database['public']['Tables']['config_rastreo']['Row']>
        Update: Partial<Database['public']['Tables']['config_rastreo']['Row']>
      }
      auth_evento: {
        Row: {
          id: string
          creado_en: string
          ip: string | null
          email_hash: string | null
          outcome: 'ok' | 'fail' | 'blocked'
          request_id: string | null
        }
        Insert: Partial<Database['public']['Tables']['auth_evento']['Row']>
        Update: Partial<Database['public']['Tables']['auth_evento']['Row']>
      }
    }
    Functions: {
      require_plataforma_aal2: { Args: Record<string, never>; Returns: undefined }
      tenant_id_actual: { Args: Record<string, never>; Returns: string }
      rol_actual: { Args: Record<string, never>; Returns: string }
    }
    Enums: Record<string, never>
  }
}
