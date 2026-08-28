import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { claimsDeUsuario } from '../../lib/claims'
import { DEMO_MODE, supabase } from '../../lib/supabase'

async function perfilDesdeDb(rol?: string, tenantId?: string): Promise<{ rol?: string; tenantId?: string }> {
  const [rolRes, tenantRes] = await Promise.all([
    rol ? Promise.resolve({ data: rol }) : supabase.rpc('rol_actual'),
    tenantId ? Promise.resolve({ data: tenantId }) : supabase.rpc('tenant_id_actual'),
  ])
  const rolDb = typeof rolRes.data === 'string' && rolRes.data.length > 0 ? rolRes.data : undefined
  const tenantDb = tenantRes.data != null && String(tenantRes.data).length > 0 ? String(tenantRes.data) : undefined
  return { rol: rolDb, tenantId: tenantDb }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [perfilDb, setPerfilDb] = useState<{ rol?: string; tenantId?: string }>({})
  const refreshPorUsuario = useRef(new Set<string>())
  const hidratarId = useRef(0)

  useEffect(() => {
    if (DEMO_MODE) {
      setLoading(false)
      return
    }

    let vivo = true

    async function hidratar(sesion: Session | null, evento?: string) {
      const id = ++hidratarId.current
      if (!sesion) {
        refreshPorUsuario.current.clear()
        if (vivo && id === hidratarId.current) {
          setSession(null)
          setPerfilDb({})
          setLoading(false)
        }
        return
      }

      let actual = sesion
      let claims = claimsDeUsuario(actual.user, actual.access_token)
      const uid = actual.user.id
      const faltaClaim = !claims.rol || !claims.tenantId
      const yaRefresco = refreshPorUsuario.current.has(uid) || evento === 'TOKEN_REFRESHED'
      if (faltaClaim && !yaRefresco) {
        refreshPorUsuario.current.add(uid)
        const { data } = await supabase.auth.refreshSession()
        if (data.session) {
          actual = data.session
          claims = claimsDeUsuario(actual.user, actual.access_token)
        }
      }

      const extra =
        !claims.rol || !claims.tenantId ? await perfilDesdeDb(claims.rol, claims.tenantId) : {}

      if (!vivo || id !== hidratarId.current) return
      setSession(actual)
      setPerfilDb(extra)
      setLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => hidratar(data.session))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sesion) => {
      void hidratar(sesion, evento)
    })

    return () => {
      vivo = false
      subscription.unsubscribe()
    }
  }, [])

  const claims = claimsDeUsuario(session?.user, session?.access_token)
  return {
    session,
    loading,
    demo: DEMO_MODE,
    rol: claims.rol ?? perfilDb.rol,
    tenantId: claims.tenantId ?? perfilDb.tenantId,
  }
}
