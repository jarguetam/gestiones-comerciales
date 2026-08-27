import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { WizardEmpresa } from './WizardEmpresa'
import type { TenantRow } from './types'

export function Empresas() {
  const { demo } = useAuth()
  const [tenants, setTenants] = useState<TenantRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setTenants([
        { id: 'demo', codigo: 'demo-agromoney', nombre: 'AgroMoney (demo)', rubro: 'agromoney', plan: 'estandar', activo: true },
        { id: 'demo2', codigo: 'demo-distri', nombre: 'Distribuidora GT (demo)', rubro: 'distribuidora', plan: 'basico', activo: true },
      ])
      return
    }
    const { data, error } = await supabase
      .from('tenant')
      .select('id, codigo, nombre, rubro, plan, activo')
      .order('creado_en', { ascending: false })
    if (error) setError(error.message)
    else setTenants(data as TenantRow[])
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <main className="mx-auto max-w-7xl p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-teal-800">P-02</p>
          <h2 className="text-2xl font-bold text-slate-900">Empresas</h2>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          + Nueva empresa
        </button>
      </div>
      {demo && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Preview estático — abrí una fila para ver detalle (P-03) y usuarios (P-04).
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Rubro</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants === null ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Sin empresas todavía. Creá la primera con el wizard.</td></tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link to={`/empresas/${t.id}`} className="text-teal-800 hover:underline">
                      {t.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t.rubro}</td>
                  <td className="px-4 py-3">{t.plan}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {t.activo ? 'activa' : 'suspendida'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {wizardOpen && (
        <WizardEmpresa
          onClose={() => setWizardOpen(false)}
          onCreated={() => { setWizardOpen(false); void cargar() }}
        />
      )}
    </main>
  )
}
