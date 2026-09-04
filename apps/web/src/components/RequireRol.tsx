import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { decisionGuardRol } from '../lib/claims'
import { mensajeCatalogo } from '../lib/erroresUi'
import { useToast } from './ui/Toast'

export function RequireRol({ children }: { children: ReactNode }) {
  const { rol, loading } = useAuth()
  const location = useLocation()
  const { push } = useToast()
  const decision = decisionGuardRol(loading, location.pathname, rol)

  useEffect(() => {
    if (decision !== 'deny') return
    push({
      titulo: mensajeCatalogo('GC-AUTH-001') ?? 'No hay sesión activa o falta el tenant.',
      descripcion: 'GC-AUTH-001',
      tone: 'error',
    })
  }, [decision, push])

  if (decision === 'loading') {
    return <p className="text-sm text-muted">Cargando…</p>
  }
  if (decision === 'deny') return <Navigate to="/" replace />
  return <>{children}</>
}
