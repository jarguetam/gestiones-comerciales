import { useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import {
  MODULOS, RUBROS, PLANES, branding, dominiosArray, wizardInicial,
  validarPaso1, validarPaso2, validarPaso3, validarPaso4,
  type WizardState,
} from './wizard'

const PASOS = ['Empresa', 'Rubro y branding', 'Módulos', 'Admin inicial']

interface Props {
  onClose: () => void
  onCreated: (tenantId: string) => void
}

export function WizardEmpresa({ onClose, onCreated }: Props) {
  const [w, setW] = useState<WizardState>(wizardInicial)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setW((prev) => ({ ...prev, [k]: v }))

  async function crear() {
    setError(null)
    if (DEMO_MODE) {
      setError('GC-AUTH-020: preview sin backend — conectá Supabase para crear empresas reales.')
      return
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Alta de empresa">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Nueva empresa</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Cerrar">✕</button>
        </header>

        <ol className="flex border-b border-slate-200 px-6 text-xs">
          {PASOS.map((p, i) => (
            <li key={p} className={`flex-1 py-3 text-center ${i + 1 === w.paso ? 'border-b-2 border-teal-700 font-semibold text-teal-800' : 'text-slate-400'}`}>
              {i + 1}. {p}
            </li>
          ))}
        </ol>

        <div className="px-6 py-5">
          {w.paso === 1 && (
            <>
              <label className="block text-sm font-medium text-slate-700">Nombre de la empresa</label>
              <input
                type="text" value={w.nombre} onChange={(e) => set('nombre', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="AgroMoney S.A." autoComplete="organization"
              />
              <label className="mt-4 block text-sm font-medium text-slate-700">Plan</label>
              <div className="mt-1 flex gap-2">
                {PLANES.map((p) => (
                  <button key={p} type="button" onClick={() => set('plan', p)}
                    className={`rounded-md border px-4 py-2 text-sm capitalize ${w.plan === p ? 'border-teal-700 bg-teal-50 font-semibold text-teal-800' : 'border-slate-300 text-slate-600'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}

          {w.paso === 2 && (
            <>
              <label className="block text-sm font-medium text-slate-700">Rubro</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {RUBROS.map((r) => (
                  <button key={r.codigo} type="button" onClick={() => set('rubro', r.codigo)}
                    className={`rounded-md border p-3 text-left ${w.rubro === r.codigo ? 'border-teal-700 bg-teal-50' : 'border-slate-300'}`}>
                    <span className="block text-sm font-medium text-slate-800">{r.nombre}</span>
                    <span className="text-xs text-slate-500">{r.descripcion}</span>
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Color primario (branding)</label>
              <input type="color" value={w.colorPrimario} onChange={(e) => set('colorPrimario', e.target.value)}
                className="mt-1 h-10 w-20 rounded border border-slate-300" />
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Dominios CORS (separados por coma)
              </label>
              <input type="text" value={w.dominios} onChange={(e) => set('dominios', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="app.agromoney.gt, admin.agromoney.gt" autoComplete="off" spellCheck={false} />
            </>
          )}

          {w.paso === 3 && (
            <>
              <p className="text-sm text-slate-600">
                El <strong>núcleo</strong> (personas, visitas, formularios, rastreo, notificaciones) siempre se activa.
                Elegí los módulos optativos:
              </p>
              <div className="mt-3 space-y-2">
                {MODULOS.map((m) => (
                  <label key={m.codigo} className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
                    <input type="checkbox" checked={w.modulos.includes(m.codigo)}
                      onChange={(e) => set('modulos', e.target.checked ? [...w.modulos, m.codigo] : w.modulos.filter((c) => c !== m.codigo))}
                      className="h-4 w-4" />
                    <span className="text-sm text-slate-800">{m.nombre} <span className="text-xs text-slate-400">({m.codigo})</span></span>
                  </label>
                ))}
              </div>
            </>
          )}

          {w.paso === 4 && (
            <>
              <p className="text-sm text-slate-600">
                Se creará el usuario de autenticación y el primer administrador de la empresa.
              </p>
              <label className="mt-4 block text-sm font-medium text-slate-700">Email del administrador</label>
              <input type="email" value={w.adminEmail} onChange={(e) => set('adminEmail', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="admin@agromoney.gt" autoComplete="off" />
              <label className="mt-4 block text-sm font-medium text-slate-700">Nombre</label>
              <input type="text" value={w.adminNombre} onChange={(e) => set('adminNombre', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="María Pérez" autoComplete="name" />
              <label className="mt-4 block text-sm font-medium text-slate-700">Contraseña inicial</label>
              <input type="password" value={w.adminPassword} onChange={(e) => set('adminPassword', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="mínimo 8 caracteres" autoComplete="new-password" />
            </>
          )}

          {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <footer className="flex justify-between border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={puedeAtras ? () => set('paso', (w.paso - 1) as WizardState['paso']) : onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            {puedeAtras ? 'Atrás' : 'Cancelar'}
          </button>
          <button type="button" onClick={siguiente} disabled={enviando}
            className="rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
            {w.paso === 4 ? (enviando ? 'Creando…' : 'Crear empresa') : 'Siguiente'}
          </button>
        </footer>
      </div>
    </div>
  )
}
