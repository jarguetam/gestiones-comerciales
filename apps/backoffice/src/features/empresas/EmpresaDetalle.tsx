import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DEMO_MODE, SUPABASE_URL, supabase } from '../../lib/supabase'
import { ejemploCurlWebhook, urlWebhookTenant } from './webhook'
import { MODULOS, PLANES, RUBROS, nombreRubro, type Plan } from './wizard'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  PAGE,
  PageHeader,
  Select,
  Skeleton,
  TabPanel,
  Tabs,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  fieldClass,
} from '../../components/ui'
import { cn } from '../../lib/cn'
import { buttonClass } from '../../components/ui/buttonVariants'

interface TenantDetalle {
  id: string
  codigo: string
  nombre: string
  rubro: string
  plan: string
  activo: boolean
  branding: { color_primario?: string } | null
  configuracion: { dominios_cors?: string[]; webhook_secret?: string } | null
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
  const [catalogoModulos, setCatalogoModulos] = useState(MODULOS)
  const [usuarios, setUsuarios] = useState<UsuarioTenant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [tab, setTab] = useState<'config' | 'usuarios'>('config')
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('asesor')
  const [password, setPassword] = useState('')
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null)
  const [rotando, setRotando] = useState(false)
  const webhookUrl = urlWebhookTenant(SUPABASE_URL)

  async function copiar(texto: string, etiqueta: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setAviso(`${etiqueta} copiado.`)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }

  const cargar = useCallback(async () => {
    if (!id) return
    setError(null)
    if (!live) {
      setTenant(DEMO_DETALLE[id] ?? DEMO_DETALLE.demo)
      setModulos(MODULOS.map((m) => ({ codigo: m.codigo, activo: m.codigo === 'crm' })))
      setCatalogoModulos(MODULOS)
      setUsuarios(DEMO_USERS)
      return
    }
    const [tRes, mRes, uRes, catRes] = await Promise.all([
      supabase.from('tenant').select('id, codigo, nombre, rubro, plan, activo, branding, configuracion').eq('id', id).maybeSingle(),
      supabase.from('tenant_modulo').select('activo, modulo(codigo)').eq('tenant_id', id),
      supabase.rpc('admin_usuarios_tenant', { p_tenant_id: id }),
      supabase.from('modulo').select('codigo, nombre, nucleo').order('codigo'),
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
    if (!catRes.error && catRes.data) {
      setCatalogoModulos(
        (catRes.data as Array<{ codigo: string; nombre: string; nucleo: boolean }>).filter((m) => !m.nucleo),
      )
    }
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
          rubro: tenant.rubro === 'agromoney' ? 'agro' : tenant.rubro,
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

  async function rotarWebhook() {
    if (!tenant) return
    setError(null)
    setAviso(null)
    setRotando(true)
    try {
      if (!live) {
        setWebhookSecret('demo-webhook-secret-no-persistido')
        setAviso('Preview: secreto de demostración (no se persiste)')
        return
      }
      const { data, error } = await supabase.rpc('admin_webhook_rotar_secret', {
        p_tenant_id: tenant.id,
      })
      if (error) throw error
      setWebhookSecret(String(data))
      setAviso('Secreto rotado. Cópialo ahora; no se vuelve a mostrar.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo rotar el secreto')
    } finally {
      setRotando(false)
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
    return (
      <main className={PAGE}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-2xl" />
      </main>
    )
  }

  const moduloActivo = (codigo: string) => modulos.find((m) => m.codigo === codigo)?.activo ?? false

  return (
    <main className={PAGE}>
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="text-sm text-primary hover:underline">← Empresas</Link>
        <Link to="/salud" className="text-sm text-primary hover:underline">Salud de plataforma</Link>
      </div>
      <PageHeader
        spec={tab === 'usuarios' ? 'P-04' : 'P-03'}
        title={tenant.nombre}
        description={`${tenant.codigo} · ${nombreRubro(tenant.rubro)}`}
      />

      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {aviso && <Alert tone="success">{aviso}</Alert>}

      <Tabs
        tabs={[
          { id: 'config', label: 'Configuración' },
          { id: 'usuarios', label: 'Usuarios' },
        ]}
        valor={tab}
        onChange={(id) => setTab(id as 'config' | 'usuarios')}
      />

      <TabPanel id="config" valor={tab}>
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <Input id="emp-nombre" label="Nombre" value={tenant.nombre} onChange={(e) => setTenant({ ...tenant, nombre: e.target.value })} />
            <p className="block text-sm font-medium text-ink">Rubro</p>
            <div className="flex flex-wrap gap-2">
              {RUBROS.map((r) => (
                <button
                  key={r.codigo}
                  type="button"
                  onClick={() => setTenant({ ...tenant, rubro: r.codigo })}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm',
                    (tenant.rubro === r.codigo || (r.codigo === 'agro' && tenant.rubro === 'agromoney'))
                      ? 'border-primary bg-primary/10 font-semibold'
                      : 'border-line',
                  )}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
            <p className="block text-sm font-medium text-ink">Plan</p>
            <div className="flex gap-2">
              {PLANES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTenant({ ...tenant, plan: p })}
                  className={cn('rounded-md border px-3 py-1.5 text-sm capitalize', tenant.plan === p ? 'border-primary bg-primary/10 font-semibold' : 'border-line')}
                >
                  {p}
                </button>
              ))}
              {!PLANES.includes(tenant.plan as Plan) && (
                <span className="self-center text-xs text-muted">actual: {tenant.plan}</span>
              )}
            </div>
            <label htmlFor="emp-color" className="block text-sm font-medium text-ink">Color de marca</label>
            <input
              id="emp-color"
              type="color"
              value={tenant.branding?.color_primario ?? '#0f766e'}
              onChange={(e) => setTenant({ ...tenant, branding: { ...tenant.branding, color_primario: e.target.value } })}
              className="h-10 w-20 rounded border border-line"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tenant.activo}
                onChange={(e) => setTenant({ ...tenant, activo: e.target.checked })}
              />
              Empresa activa
            </label>
            <Button onClick={() => void guardarConfig()} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="mb-3 font-medium">Módulos</h3>
            <div className="space-y-2">
              {catalogoModulos.map((m) => (
                <label key={m.codigo} className="flex items-center gap-3 rounded-md border border-line p-3">
                  <input
                    type="checkbox"
                    checked={moduloActivo(m.codigo)}
                    onChange={(e) => void toggleModulo(m.codigo, e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{m.nombre} <span className="text-xs text-muted">({m.codigo})</span></span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <h3 className="font-medium">Webhook del rubro</h3>
            <p className="text-sm text-muted">
              Los sistemas externos firman el cuerpo con HMAC-SHA256 y envían
              {' '}<code className="text-xs">X-GC-Signature</code> + <code className="text-xs">X-GC-Tenant-Id</code>.
            </p>
            <label htmlFor="emp-webhook-url" className="block text-xs font-medium text-muted">URL</label>
            <div className="flex gap-2">
              <input
                id="emp-webhook-url"
                readOnly
                value={webhookUrl}
                className={cn(fieldClass, 'font-mono text-xs')}
              />
              <Button variant="secondary" size="sm" onClick={() => void copiar(webhookUrl, 'URL')}>
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted">
              {tenant.configuracion?.webhook_secret
                ? 'Hay un secreto configurado. Rotarlo invalida el anterior.'
                : 'Aún no hay secreto. Generá uno para habilitar el webhook.'}
            </p>
            <Button variant="secondary" onClick={() => void rotarWebhook()} disabled={rotando}>
              {rotando ? 'Rotando…' : 'Rotar secreto HMAC'}
            </Button>
            {webhookSecret && (
              <div>
                <label htmlFor="emp-webhook-secret" className="block text-xs font-medium text-muted">Secreto (una sola vez)</label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="emp-webhook-secret"
                    readOnly
                    value={webhookSecret}
                    className={cn(fieldClass, 'border-amber-300 bg-amber-50 font-mono text-xs')}
                  />
                  <Button variant="secondary" size="sm" onClick={() => void copiar(webhookSecret, 'Secreto')}>
                    Copiar
                  </Button>
                </div>
              </div>
            )}
            <details className="text-xs text-muted">
              <summary className="cursor-pointer font-medium">Ejemplo curl</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-ink p-3 text-[11px] text-canvas">
                {ejemploCurlWebhook(SUPABASE_URL ?? 'https://ejemplo.supabase.co', tenant.id)}
              </pre>
            </details>
          </div>
        </div>
      </TabPanel>

      <TabPanel id="usuarios" valor={tab}>
        <div className="space-y-4">
          <form onSubmit={(e) => void invitar(e)} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2">
            <h3 className="font-medium md:col-span-2">Invitar usuario</h3>
            <Input id="inv-email" label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <Input id="inv-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
            <Select id="inv-rol" label="Rol" value={rol} onChange={(e) => setRol(e.target.value)}>
              {['admin', 'gerente', 'supervisor', 'asesor'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
            <Input id="inv-pass" label="Contraseña inicial" required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña inicial" />
            <div className="md:col-span-2">
              <Button type="submit">Invitar</Button>
            </div>
          </form>

          {usuarios.length === 0 ? (
            <EmptyState titulo="Sin usuarios en esta empresa" />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Nombre</Th>
                  <Th>Email</Th>
                  <Th>Rol</Th>
                  <Th>Estado</Th>
                </Tr>
              </THead>
              <TBody>
                {usuarios.map((u) => (
                  <Tr key={u.id}>
                    <Td className="font-medium">{u.nombre}</Td>
                    <Td className="text-muted">{u.email ?? '—'}</Td>
                    <Td>
                      <select
                        value={u.rol}
                        onChange={(e) => void gestionarUsuario(u.id, 'cambiar_rol', { rol: e.target.value })}
                        className="rounded border border-line px-1 py-0.5 text-xs"
                        aria-label={`Rol de ${u.nombre}`}
                      >
                        {['admin', 'gerente', 'supervisor', 'asesor'].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => void gestionarUsuario(u.id, u.activo ? 'desactivar' : 'activar')}
                        className={buttonClass('ghost', 'sm')}
                      >
                        <Badge tone={u.activo ? 'success' : 'neutral'}>{u.activo ? 'activo' : 'inactivo'}</Badge>
                      </button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </TabPanel>
    </main>
  )
}
