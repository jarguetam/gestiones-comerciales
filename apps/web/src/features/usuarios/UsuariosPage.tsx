import { useCallback, useEffect, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { mensajeGc } from '../../lib/persistir'
import { useDominio } from '../../app/DominioContext'
import { useAuth } from '../auth/useAuth'

const ROLES = ['admin', 'gerente', 'supervisor', 'asesor'] as const
type Rol = (typeof ROLES)[number]

export interface UsuarioEmpresa {
  id: string
  nombre: string
  rol: Rol
  activo: boolean
  jefe_id: string | null
  zona_id: number | null
  email: string | null
}

const DEMO_USUARIOS: UsuarioEmpresa[] = [
  { id: 'u1', nombre: 'Ana Admin', rol: 'admin', activo: true, jefe_id: null, zona_id: null, email: 'ana@demo.gt' },
  { id: 'u2', nombre: 'Erick Supervisor', rol: 'supervisor', activo: true, jefe_id: 'u1', zona_id: 1, email: 'erick@demo.gt' },
  { id: 'u3', nombre: 'Luisa Asesora', rol: 'asesor', activo: true, jefe_id: 'u2', zona_id: 1, email: 'luisa@demo.gt' },
]

export function UsuariosPage() {
  const { fuente } = useDominio()
  const { session } = useAuth()
  const live = !DEMO_MODE && fuente === 'supabase'
  const rolSesion = (session?.user.app_metadata?.rol as string | undefined) ?? (DEMO_MODE ? 'admin' : undefined)
  const puedeEditar = DEMO_MODE || rolSesion === 'admin'
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>(DEMO_USUARIOS)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Rol>('asesor')
  const [jefeId, setJefeId] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    if (!live) return
    const { data, error } = await supabase.rpc('usuarios_empresa')
    if (error) setError(error.message)
    else setUsuarios((data ?? []) as UsuarioEmpresa[])
  }, [live])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    if (!puedeEditar) return
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setEnviando(true)
    try {
      if (!live) {
        setUsuarios((prev) => [
          ...prev,
          {
            id: `u${Date.now()}`,
            nombre: nombre.trim() || email,
            rol,
            activo: true,
            jefe_id: jefeId || null,
            zona_id: null,
            email,
          },
        ])
        setEmail('')
        setNombre('')
        setPassword('')
        setAviso('Usuario agregado (demo)')
        return
      }
      const tenantId = session?.user.app_metadata?.tenant_id as string | undefined
      const { data, error } = await supabase.functions.invoke('invitar-usuario', {
        body: {
          tenant_id: tenantId,
          email: email.trim(),
          nombre: nombre.trim() || email.trim(),
          rol,
          password,
          jefe_id: jefeId || null,
        },
      })
      if (error) throw error
      const payload = data as { error?: string } | null
      if (payload?.error) throw new Error(payload.error)
      setEmail('')
      setNombre('')
      setPassword('')
      setAviso('Usuario invitado')
      await cargar()
    } catch (err) {
      setError(mensajeGc(err))
    } finally {
      setEnviando(false)
    }
  }

  async function gestionar(id: string, accion: string, datos: Record<string, unknown> = {}) {
    setError(null)
    try {
      if (!live) {
        setUsuarios((prev) =>
          prev.map((u) => {
            if (u.id !== id) return u
            if (accion === 'activar') return { ...u, activo: true }
            if (accion === 'desactivar') return { ...u, activo: false }
            if (accion === 'cambiar_rol') return { ...u, rol: datos.rol as Rol }
            if (accion === 'cambiar_jefe') return { ...u, jefe_id: (datos.jefe_id as string) || null }
            return u
          }),
        )
        return
      }
      const { error } = await supabase.rpc('admin_usuario_gestionar', {
        p_usuario_id: id,
        p_accion: accion,
        p_datos: datos,
      })
      if (error) throw error
      await cargar()
    } catch (err) {
      setError(mensajeGc(err))
    }
  }

  const nombreDe = (id: string | null) => usuarios.find((u) => u.id === id)?.nombre ?? '—'

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-11</p>
        <h2 className="font-serif text-3xl">Usuarios</h2>
        <p className="text-sm text-slate-600">Estructura comercial: gerente → supervisor → asesor.</p>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}

      {puedeEditar && (
        <form onSubmit={(e) => void invitar(e)} className="rounded-2xl border border-[#E4DCC8] bg-white p-4 grid gap-3 md:grid-cols-2">
          <h3 className="md:col-span-2 font-medium">Invitar usuario</h3>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={jefeId} onChange={(e) => setJefeId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Sin jefe</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
            ))}
          </select>
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña inicial (mín. 8)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={enviando} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {enviando ? 'Invitando…' : 'Invitar'}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#E4DCC8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#EFE8D8] text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3 hidden md:table-cell">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3 hidden lg:table-cell">Jefe</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-[#F8F4EA]">
                <td className="px-4 py-3 font-medium">{u.nombre}</td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-600">{u.email ?? '—'}</td>
                <td className="px-4 py-3">
                  {puedeEditar ? (
                    <select
                      value={u.rol}
                      onChange={(e) => void gestionar(u.id, 'cambiar_rol', { rol: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs capitalize"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="capitalize">{u.rol}</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{nombreDe(u.jefe_id)}</td>
                <td className="px-4 py-3">
                  {puedeEditar ? (
                    <button
                      type="button"
                      onClick={() => void gestionar(u.id, u.activo ? 'desactivar' : 'activar')}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold"
                    >
                      {u.activo ? 'activo' : 'inactivo'}
                    </button>
                  ) : (
                    <span className="text-xs">{u.activo ? 'activo' : 'inactivo'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
