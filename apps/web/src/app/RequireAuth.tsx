import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

interface Props {
  children: ReactNode
}

export function RequireAuth({ children }: Props) {
  const { session, loading, demo } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink">Cargando…</div>
  }

  if (!session && !demo) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}