import type { SupabaseClient } from '@supabase/supabase-js'

type AuthGuardOk = {
  session?: {
    access_token: string
    refresh_token: string
  }
  requires_mfa?: boolean
  error?: string
}

/** Inicia sesión vía Edge auth-guard (rate limit + auditoría). */
export async function loginConAuthGuard(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<{ requiresMfa: boolean }> {
  const { data, error } = await supabase.functions.invoke('auth-guard', {
    body: { email, password },
  })
  if (error) throw error
  const payload = data as AuthGuardOk | null
  if (!payload) throw new Error('GC-AUTH-012: respuesta vacía del guard')
  if (payload.error) throw new Error(payload.error)
  if (payload.session) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: payload.session.access_token,
      refresh_token: payload.session.refresh_token,
    })
    if (sessionError) throw sessionError
  }
  return { requiresMfa: Boolean(payload.requires_mfa) }
}
