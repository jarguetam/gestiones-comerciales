import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { debeCambiarClave } from '../features/auth/cambioClave'
import { CambioClaveObligatorio } from '../features/auth/CambioClaveObligatorio'

interface Props {
  children: ReactNode
}

export function RequireAuth({ children }: Props) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink">Cargando…</div>
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (debeCambiarClave(session.user)) {
    return <CambioClaveObligatorio />
  }

  return <>{children}</>
}
