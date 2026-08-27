import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { DEMO_MODE, supabase } from '../../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

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

  return { session, loading, demo: DEMO_MODE }
}
