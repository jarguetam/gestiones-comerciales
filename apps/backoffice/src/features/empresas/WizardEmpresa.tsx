import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  MODULOS, RUBROS, PLANES, branding, dominiosArray, wizardInicial,
  validarPaso1, validarPaso2, validarPaso3, validarPaso4,
  type WizardState, type ModuloInfo,
} from './wizard'
import { Alert, Button, Dialog, Input } from '../../components/ui'
import { cn } from '../../lib/cn'

const PASOS = ['Empresa', 'Rubro y branding', 'Módulos', 'Admin inicial']

interface Props {
  onClose: () => void
  onCreated: (tenantId: string) => void
}

export function WizardEmpresa({ onClose, onCreated }: Props) {
  const [w, setW] = useState<WizardState>(wizardInicial)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [modulos, setModulos] = useState<ModuloInfo[]>(MODULOS)

  useEffect(() => {
    void supabase.from('modulo').select('codigo, nombre, nucleo').order('codigo').then(({ data }) => {
      if (!data) return
      const optativos = (data as ModuloInfo[]).filter((m) => !m.nucleo)
      if (optativos.length > 0) setModulos(optativos)
    })
  }, [])

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setW((prev) => ({ ...prev, [k]: v }))

  async function crear() {
    setError(null)
    setEnviando(true)
    try {
      // 1) crear tenant (módulos incluidos) — dominios CORS van en configuracion
      const { data, error: rpcError } = await supabase.rpc('admin_tenant_crear', {
        p_nombre: w.nombre.trim(),
        p_rubro: w.rubro,
        p_plan: w.plan,
        p_branding: branding(w),
        p_configuracion: { dominios_cors: dominiosArray(w) ?? [] },
        p_modulos: w.modulos.length > 0 ? w.modulos : null,
      })
      if (rpcError) throw rpcError
      const tenantId = data as string

      // 2) invitar al primer admin de la empresa (el auth user debe existir)
      if (w.adminEmail.trim()) {
        const { data: invited, error: invError } = await supabase.functions.invoke('invitar-usuario', {
          body: {
            tenant_id: tenantId,
            email: w.adminEmail.trim(),
            nombre: w.adminNombre.trim() || w.adminEmail.trim(),
            rol: 'admin',
            password: w.adminPassword,
          },
        })
        if (invError) throw invError
        const invitado = invited as { error?: string } | null
        if (invitado?.error) throw new Error(invitado.error)
      }

      onCreated(tenantId)
    } catch (e) {
      // mensaje genérico sin fuga interna (A07)
      setError(e instanceof Error && e.message.startsWith('GC-') ? e.message : 'No se pudo crear la empresa.')
    } finally {
      setEnviando(false)
    }
  }

  async function siguiente() {
    const err =
      w.paso === 1 ? validarPaso1(w) :
      w.paso === 2 ? validarPaso2(w) :
      w.paso === 3 ? validarPaso3(w) :
      validarPaso4(w)
    if (err) { setError(err); return }
    setError(null)
    if (w.paso < 4) { set('paso', (w.paso + 1) as WizardState['paso']); return }
    await crear()
  }

  const puedeAtras = w.paso > 1

  return (
    <Dialog title="Nueva empresa" onClose={onClose} className="max-w-2xl">
      <ol className="flex border-b border-line px-6 text-xs">
        {PASOS.map((p, i) => (
          <li key={p} className={cn('flex-1 py-3 text-center', i + 1 === w.paso ? 'border-b-2 border-primary font-semibold text-primary' : 'text-muted')}>
            {i + 1}. {p}
          </li>
        ))}
      </ol>

      <div className="px-6 py-5">
        {w.paso === 1 && (
          <>
            <Input id="wiz-nombre" label="Nombre de la empresa" type="text" value={w.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="AgroMoney S.A." autoComplete="organization" />
            <p className="mt-4 block text-sm font-medium text-ink">Plan</p>
            <div className="mt-1 flex gap-2">
              {PLANES.map((p) => (
                <button key={p} type="button" onClick={() => set('plan', p)}
                  className={cn('rounded-md border px-4 py-2 text-sm capitalize', w.plan === p ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-line text-muted')}>
                  {p}
                </button>
              ))}
            </div>
          </>
        )}

        {w.paso === 2 && (
          <>
            <p className="block text-sm font-medium text-ink">Rubro</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {RUBROS.map((r) => (
                <button key={r.codigo} type="button" onClick={() => set('rubro', r.codigo)}
                  className={cn('rounded-md border p-3 text-left', w.rubro === r.codigo ? 'border-primary bg-primary/10' : 'border-line')}>
                  <span className="block text-sm font-medium text-ink">{r.nombre}</span>
                  <span className="text-xs text-muted">{r.descripcion}</span>
                </button>
              ))}
            </div>
            <label htmlFor="wiz-color" className="mt-4 block text-sm font-medium text-ink">Color primario (branding)</label>
            <input id="wiz-color" type="color" value={w.colorPrimario} onChange={(e) => set('colorPrimario', e.target.value)}
              className="mt-1 h-10 w-20 rounded border border-line" />
            <Input id="wiz-dominios" label="Dominios CORS (separados por coma)" type="text" value={w.dominios} onChange={(e) => set('dominios', e.target.value)}
              placeholder="app.agromoney.gt, admin.agromoney.gt" autoComplete="off" spellCheck={false} />
          </>
        )}

        {w.paso === 3 && (
          <>
            <p className="text-sm text-muted">
              El <strong>núcleo</strong> (personas, visitas, formularios, rastreo, notificaciones) siempre se activa.
              Elegí los módulos optativos:
            </p>
            <div className="mt-3 space-y-2">
              {modulos.map((m) => (
                <label key={m.codigo} className="flex items-center gap-3 rounded-md border border-line p-3">
                  <input type="checkbox" checked={w.modulos.includes(m.codigo)}
                    onChange={(e) => set('modulos', e.target.checked ? [...w.modulos, m.codigo] : w.modulos.filter((c) => c !== m.codigo))}
                    className="h-4 w-4" />
                  <span className="text-sm text-ink">{m.nombre} <span className="text-xs text-muted">({m.codigo})</span></span>
                </label>
              ))}
            </div>
          </>
        )}

        {w.paso === 4 && (
          <>
            <p className="text-sm text-muted">
              Se creará el usuario de autenticación y el primer administrador de la empresa.
            </p>
            <Input id="wiz-admin-email" label="Email del administrador" type="email" value={w.adminEmail} onChange={(e) => set('adminEmail', e.target.value)}
              placeholder="admin@agromoney.gt" autoComplete="off" />
            <Input id="wiz-admin-nombre" label="Nombre" type="text" value={w.adminNombre} onChange={(e) => set('adminNombre', e.target.value)}
              placeholder="María Pérez" autoComplete="name" />
            <Input id="wiz-admin-pass" label="Contraseña inicial" type="password" value={w.adminPassword} onChange={(e) => set('adminPassword', e.target.value)}
              placeholder="mínimo 8 caracteres" autoComplete="new-password" />
          </>
        )}

        {error && <div className="mt-4"><Alert tone="danger" role="alert">{error}</Alert></div>}
      </div>

      <footer className="flex justify-between border-t border-line px-6 py-4">
        <Button variant="secondary" onClick={puedeAtras ? () => set('paso', (w.paso - 1) as WizardState['paso']) : onClose}>
          {puedeAtras ? 'Atrás' : 'Cancelar'}
        </Button>
        <Button onClick={() => void siguiente()} disabled={enviando}>
          {w.paso === 4 ? (enviando ? 'Creando…' : 'Crear empresa') : 'Siguiente'}
        </Button>
      </footer>
    </Dialog>
  )
}
