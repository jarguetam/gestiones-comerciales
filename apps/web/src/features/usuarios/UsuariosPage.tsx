import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeGc } from '../../lib/persistir'
import { useDominio } from '../../app/DominioContext'
import { useAuth } from '../auth/useAuth'
import { Alert, Button, PageHeader, PAGE, Table, THead, Th, TBody, Tr, Td, Badge } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { fieldClass } from '../../components/ui'

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

export function UsuariosPage() {
  const { fuente } = useDominio()
  const { rol: rolAuth, tenantId: tenantAuth } = useAuth()
  const { push } = useToast()
  const live = fuente === 'supabase'
  const rolSesion = rolAuth
  const puedeEditar = rolSesion === 'admin'
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])
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
      const tenantId = tenantAuth
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
      push({ tone: 'success', titulo: 'Usuario invitado' })
      await cargar()
    } catch (err) {
      const msg = mensajeGc(err)
      setError(msg)
      push({ tone: 'error', titulo: msg })
    } finally {
      setEnviando(false)
    }
  }

  async function gestionar(id: string, accion: string, datos: Record<string, unknown> = {}) {
    setError(null)
    try {
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
    <div className={PAGE}>
      <PageHeader spec="W-11" title="Usuarios" description="Estructura comercial: gerente → supervisor → asesor." />

      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {aviso && <Alert tone="success">{aviso}</Alert>}

      {puedeEditar && (
        <form onSubmit={(e) => void invitar(e)} className="rounded-2xl border border-line bg-surface p-4 grid gap-3 md:grid-cols-2">
          <h3 className="md:col-span-2 font-medium">Invitar usuario</h3>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={fieldClass} />
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className={fieldClass} />
          <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} className={fieldClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={jefeId} onChange={(e) => setJefeId(e.target.value)} className={fieldClass}>
            <option value="">Sin jefe</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
            ))}
          </select>
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña inicial (mín. 8)" className={fieldClass} />
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Invitando…' : 'Invitar'}
          </Button>
        </form>
      )}

      <Table>
        <THead>
          <tr>
            <Th>Nombre</Th>
            <Th className="hidden md:table-cell">Email</Th>
            <Th>Rol</Th>
            <Th className="hidden lg:table-cell">Jefe</Th>
            <Th>Estado</Th>
          </tr>
        </THead>
        <TBody>
          {usuarios.map((u) => (
            <Tr key={u.id}>
              <Td className="font-medium">{u.nombre}</Td>
              <Td className="hidden md:table-cell text-muted">{u.email ?? '—'}</Td>
              <Td>
                {puedeEditar ? (
                  <select
                    value={u.rol}
                    onChange={(e) => void gestionar(u.id, 'cambiar_rol', { rol: e.target.value })}
                    className="rounded border border-line bg-surface px-1 py-0.5 text-xs capitalize"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <span className="capitalize">{u.rol}</span>
                )}
              </Td>
              <Td className="hidden lg:table-cell text-muted">{nombreDe(u.jefe_id)}</Td>
              <Td>
                {puedeEditar ? (
                  <Button variant="ghost" size="sm" onClick={() => void gestionar(u.id, u.activo ? 'desactivar' : 'activar')}>
                    {u.activo ? 'activo' : 'inactivo'}
                  </Button>
                ) : (
                  <Badge tone={u.activo ? 'success' : 'neutral'}>{u.activo ? 'activo' : 'inactivo'}</Badge>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  )
}
