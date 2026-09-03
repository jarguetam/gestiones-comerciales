import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { canAccess } from '../lib/claims'
import { mensajeCatalogo } from '../lib/erroresUi'
import { useToast } from './ui/Toast'

export function RequireRol({ children }: { children: ReactNode }) {
  const { rol } = useAuth()
  const location = useLocation()
  const { push } = useToast()
  const ok = canAccess(location.pathname, rol)

  useEffect(() => {
    if (ok) return
    push({
      titulo: mensajeCatalogo('GC-AUTH-001') ?? 'No hay sesión activa o falta el tenant.',
      descripcion: 'GC-AUTH-001',
      tone: 'error',
    })
  }, [ok, push])

  if (!ok) return <Navigate to="/" replace />
  return <>{children}</>
}
