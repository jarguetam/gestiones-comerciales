import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { resolveBackofficeAccess, type BackofficeAccess } from '../../lib/plataformaRol'
import { MfaPage } from '../auth/MfaPage'
import { ChallengeMfaPage } from './ChallengeMfaPage'
import { ForbiddenPage } from './ForbiddenPage'

export function RequireMfa() {
  const { session, loading } = useAuth()
  const [access, setAccess] = useState<BackofficeAccess | null>(null)

  useEffect(() => {
    if (loading) return
    if (!session) {
      setAccess('login')
      return
    }

    let vivo = true
    void Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
      .then(([factors, aal]) => {
        if (!vivo) return
        setAccess(
          resolveBackofficeAccess({
            session,
            factors: factors.data,
            aal: aal.data?.currentLevel ?? null,
          }),
        )
      })
      .catch(() => {
        if (!vivo) return
        setAccess(resolveBackofficeAccess({ session, factors: { totp: [] }, aal: null }))
      })

    return () => {
      vivo = false
    }
  }, [loading, session])

  if (loading || access === null) {
    return <div className="flex min-h-screen items-center justify-center">Cargando…</div>
  }
  if (access === 'forbidden') return <ForbiddenPage />
  if (access === 'enroll_mfa') return <MfaPage />
  if (access === 'challenge_mfa') return <ChallengeMfaPage />
  return <Outlet />
}
