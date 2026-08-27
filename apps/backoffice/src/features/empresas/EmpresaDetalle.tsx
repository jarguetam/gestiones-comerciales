import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { MODULOS, PLANES, type Plan } from './wizard'

interface TenantDetalle {
  id: string
  codigo: string
  nombre: string
  rubro: string
  plan: string
  activo: boolean
  branding: { color_primario?: string } | null
  configuracion: { dominios_cors?: string[] } | null
}

interface ModuloTenant {
  codigo: string
  activo: boolean
}

interface UsuarioTenant {
  id: string
  nombre: string
  rol: string
  activo: boolean
  jefe_id: string | null
  zona_id: number | null
  email: string | null
}

const DEMO_DETALLE: Record<string, TenantDetalle> = {
  demo: {
    id: 'demo',
    codigo: 'demo-agromoney',
    nombre: 'AgroMoney (demo)',
    rubro: 'agromoney',
    plan: 'estandar',
    activo: true,
    branding: { color_primario: '#0f766e' },
    configuracion: { dominios_cors: ['app.agromoney.gt'] },
  },
  demo2: {
    id: 'demo2',
    codigo: 'demo-distri',
    nombre: 'Distribuidora GT (demo)',
    rubro: 'distribuidora',
    plan: 'basico',
    activo: true,
    branding: { color_primario: '#1d4ed8' },
    configuracion: null,
  },
}

const DEMO_USERS: UsuarioTenant[] = [
  { id: 'u1', nombre: 'Ana Admin', rol: 'admin', activo: true, jefe_id: null, zona_id: null, email: 'ana@demo.gt' },
]

export function EmpresaDetalle() {
  const { id } = useParams<{ id: string }>()
  const live = !DEMO_MODE
  const [tenant, setTenant] = useState<TenantDetalle | null>(null)
  const [modulos, setModulos] = useState<ModuloTenant[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioTenant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [tab, setTab] = useState<'config' | 'usuarios'>('config')
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('asesor')
  const [password, setPassword] = useState('')

  const cargar = useCallback(async () => {
    if (!id) return
    setError(null)
    if (!live) {
      setTenant(DEMO_DETALLE[id] ?? DEMO_DETALLE.demo)
      setModulos(MODULOS.map((m) => ({ codigo: m.codigo, activo: m.codigo === 'crm' })))
      setUsuarios(DEMO_USERS)
      return
    }
    const [tRes, mRes, uRes] = await Promise.all([
      supabase.from('tenant').select('id, codigo, nombre, rubro, plan, activo, branding, configuracion').eq('id', id).maybeSingle(),
      supabase.from('tenant_modulo').select('activo, modulo(codigo)').eq('tenant_id', id),
      supabase.rpc('admin_usuarios_tenant', { p_tenant_id: id }),
    ])
    if (tRes.error) {
      setError(tRes.error.message)
      return
    }
    setTenant(tRes.data as TenantDetalle)
    setModulos(
      ((mRes.data ?? []) as Array<{ activo: boolean; modulo: { codigo?: string } | { codigo?: string }[] | null }>).map((row) => {
        const m = Array.isArray(row.modulo) ? row.modulo[0] : row.modulo
        return { codigo: m?.codigo ?? '', activo: row.activo }
      }).filter((m) => m.codigo),
    )
    if (uRes.error) setError(uRes.error.message)
    else setUsuarios((uRes.data ?? []) as UsuarioTenant[])
  }, [id, live])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function guardarConfig() {
    if (!tenant) return
    setError(null)
    setAviso(null)
    setGuardando(true)
    try {
      if (!live) {
        setAviso('Preview: no se persiste')
        return
      }
      const { error } = await supabase.rpc('admin_tenant_actualizar', {
        p_tenant_id: tenant.id,
        p_cambios: {
          nombre: tenant.nombre,
          plan: tenant.plan,
          activo: tenant.activo,
          branding: tenant.branding ?? {},
          dominios: tenant.configuracion?.dominios_cors ?? [],
        },
      })
      if (error) throw error
      setAviso('Empresa actualizada')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleModulo(codigo: string, activo: boolean) {
    setError(null)
    try {
      if (!live || !tenant) {
        setModulos((prev) => {
          const existe = prev.some((m) => m.codigo === codigo)
          return existe ? prev.map((m) => (m.codigo === codigo ? { ...m, activo } : m)) : [...prev, { codigo, activo }]
        })
        return
      }
      const { error } = await supabase.rpc('admin_modulo_activar', {
        p_tenant_id: tenant.id,
        p_modulo: codigo,
        p_activo: activo,
      })
      if (error) throw error
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el módulo')
    }
  }

  async function gestionarUsuario(usuarioId: string, accion: string, datos: Record<string, unknown> = {}) {
    setError(null)
    try {
      if (!live) {
        setUsuarios((prev) =>
          prev.map((u) => {
            if (u.id !== usuarioId) return u
            if (accion === 'activar') return { ...u, activo: true }
            if (accion === 'desactivar') return { ...u, activo: false }
            if (accion === 'cambiar_rol') return { ...u, rol: String(datos.rol) }
            return u
          }),
        )
        return
      }
      const { error } = await supabase.rpc('admin_usuario_gestionar', {
        p_usuario_id: usuarioId,
        p_accion: accion,
        p_datos: datos,
      })
      if (error) throw error
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo gestionar el usuario')
    }
  }

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setError(null)
    setAviso(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    try {
      if (!live) {
        setUsuarios((prev) => [
          ...prev,
          { id: `u${Date.now()}`, nombre: nombre || email, rol, activo: true, jefe_id: null, zona_id: null, email },
        ])
        setEmail('')
        setNombre('')
        setPassword('')
        setAviso('Usuario agregado (demo)')
        return
      }
      const { data, error } = await supabase.functions.invoke('invitar-usuario', {
        body: { tenant_id: tenant.id, email: email.trim(), nombre: nombre.trim() || email.trim(), rol, password },
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
      setError(err instanceof Error ? err.message : 'No se pudo invitar')
    }
  }

  if (!tenant) {
    return <main className="p-6 text-slate-500">Cargando empresa…</main>
  }

  const moduloActivo = (codigo: string) => modulos.find((m) => m.codigo === codigo)?.activo ?? false

  return (
    <main className="mx-auto max-w-5xl p-4 space-y-4">
      <Link to="/" className="text-sm text-teal-800 hover:underline">← Empresas</Link>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-teal-800">P-03 / P-04</p>
        <h2 className="text-2xl font-bold text-slate-900">{tenant.nombre}</h2>
        <p className="text-sm text-slate-500">{tenant.codigo} · {tenant.rubro}</p>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('config')} className={`rounded-full px-3 py-1 text-xs font-medium ${tab === 'config' ? 'bg-teal-700 text-white' : 'bg-white border border-slate-200'}`}>
          Configuración
        </button>
        <button type="button" onClick={() => setTab('usuarios')} className={`rounded-full px-3 py-1 text-xs font-medium ${tab === 'usuarios' ? 'bg-teal-700 text-white' : 'bg-white border border-slate-200'}`}>
          Usuarios
        </button>
      </div>

      {tab === 'config' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-4 shadow space-y-3">
            <label className="block text-sm font-medium">Nombre</label>
            <input value={tenant.nombre} onChange={(e) => setTenant({ ...tenant, nombre: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <label className="block text-sm font-medium">Plan</label>
            <div className="flex gap-2">
              {PLANES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTenant({ ...tenant, plan: p })}
                  className={`rounded-md border px-3 py-1.5 text-sm capitalize ${tenant.plan === p ? 'border-teal-700 bg-teal-50 font-semibold' : 'border-slate-300'}`}
                >
                  {p}
                </button>
              ))}
              {!PLANES.includes(tenant.plan as Plan) && (
                <span className="text-xs text-slate-500 self-center">actual: {tenant.plan}</span>
              )}
            </div>
            <label className="block text-sm font-medium">Color de marca</label>
            <input
              type="color"
              value={tenant.branding?.color_primario ?? '#0f766e'}
              onChange={(e) => setTenant({ ...tenant, branding: { ...tenant.branding, color_primario: e.target.value } })}
              className="h-10 w-20 rounded border"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tenant.activo}
                onChange={(e) => setTenant({ ...tenant, activo: e.target.checked })}
              />
              Empresa activa
            </label>
            <button type="button" onClick={() => void guardarConfig()} disabled={guardando} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>

          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="font-medium mb-3">Módulos</h3>
            <div className="space-y-2">
              {MODULOS.map((m) => (
                <label key={m.codigo} className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
                  <input
                    type="checkbox"
                    checked={moduloActivo(m.codigo)}
                    onChange={(e) => void toggleModulo(m.codigo, e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{m.nombre} <span className="text-xs text-slate-400">({m.codigo})</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="space-y-4">
          <form onSubmit={(e) => void invitar(e)} className="rounded-lg bg-white p-4 shadow grid gap-3 md:grid-cols-2">
            <h3 className="md:col-span-2 font-medium">Invitar usuario</h3>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select value={rol} onChange={(e) => setRol(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {['admin', 'gerente', 'supervisor', 'asesor'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña inicial" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Invitar</button>
          </form>

          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium">{u.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.rol}
                        onChange={(e) => void gestionarUsuario(u.id, 'cambiar_rol', { rol: e.target.value })}
                        className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                      >
                        {['admin', 'gerente', 'supervisor', 'asesor'].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void gestionarUsuario(u.id, u.activo ? 'desactivar' : 'activar')}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                      >
                        {u.activo ? 'activo' : 'inactivo'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
