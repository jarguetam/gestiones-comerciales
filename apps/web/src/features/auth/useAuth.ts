import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { claimsDeUsuario } from '../../lib/claims'
import { DEMO_MODE, supabase } from '../../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [rolDb, setRolDb] = useState<string | undefined>()

  useEffect(() => {
    if (DEMO_MODE) {
      // demo: sin backend, sin sesión — la UI muestra el login bloqueado
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const claims = useMemo(
    () => claimsDeUsuario(session?.user, session?.access_token),
    [session],
  )

  useEffect(() => {
    if (DEMO_MODE || !session || claims.rol) {
      setRolDb(undefined)
      return
    }
    // Admins invitados antes de copiar claims al JWT: rol_actual() lee public.usuario.
    void supabase.rpc('rol_actual').then(({ data }) => {
      if (typeof data === 'string' && data.length > 0) setRolDb(data)
    })
  }, [session, claims.rol])

  return {
    session,
    loading,
    demo: DEMO_MODE,
    rol: claims.rol ?? rolDb,
    tenantId: claims.tenantId,
  }
}
