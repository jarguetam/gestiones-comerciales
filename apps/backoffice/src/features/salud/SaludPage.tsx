import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import {
  demoSalud,
  estadoJob,
  etiquetaEstado,
  formatearBytes,
  resumenSalud,
  type EstadoJob,
  type SaludPlataforma,
} from './salud'

const ESTILO_KPI = 'rounded-lg bg-white p-4 shadow'
const BADGE: Record<EstadoJob, string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  fallo: 'bg-red-100 text-red-800',
  atrasado: 'bg-amber-100 text-amber-800',
  no_programado: 'bg-slate-100 text-slate-600',
}

export function SaludPage() {
  const [salud, setSalud] = useState<SaludPlataforma | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    if (DEMO_MODE) {
      setSalud(demoSalud())
      return
    }
    const { data, error } = await supabase.rpc('admin_salud_plataforma')
    if (error) {
      setError(error.message)
      setSalud(null)
      return
    }
    setSalud(data as SaludPlataforma)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const resumen = useMemo(() => (salud ? resumenSalud(salud) : null), [salud])

  return (
    <main className="mx-auto max-w-7xl p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-teal-800">P-06</p>
          <h2 className="text-2xl font-bold text-slate-900">Salud de plataforma</h2>
          <p className="mt-1 text-sm text-slate-600">
            Jobs pg_cron, errores de Edge e integraciones, y uso por empresa (dispositivos, storage,
            notificaciones).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Actualizar
        </button>
      </div>

      {DEMO_MODE && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Preview estático — métricas de demostración sin backend.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {!salud || !resumen ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <article className={ESTILO_KPI}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Empresas activas</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{resumen.tenantsActivos}</p>
            </article>
            <article className={ESTILO_KPI}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Dispositivos</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{resumen.dispositivos}</p>
            </article>
            <article className={ESTILO_KPI}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Errores 24 h</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{resumen.errores24h}</p>
            </article>
            <article className={ESTILO_KPI}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Jobs con problema</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{resumen.jobsProblema}</p>
            </article>
          </section>

          <section className="mb-6 overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Jobs pg_cron</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Cron</th>
                  <th className="px-4 py-3">Última corrida</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salud.jobs.map((j) => {
                  const estado = estadoJob(j)
                  return (
                    <tr key={j.nombre}>
                      <td className="px-4 py-3 font-medium text-slate-800">{j.nombre}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{j.schedule}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {j.ultima_corrida ? new Date(j.ultima_corrida).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[estado]}`}>
                          {etiquetaEstado(estado)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Uso por empresa</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Dispositivos</th>
                  <th className="px-4 py-3">Notificaciones 24 h</th>
                  <th className="px-4 py-3">Storage</th>
                  <th className="px-4 py-3">Errores Edge</th>
                  <th className="px-4 py-3">Errores integración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salud.tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Sin empresas en tu alcance.
                    </td>
                  </tr>
                ) : (
                  salud.tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <Link to={`/empresas/${t.id}`} className="text-teal-800 hover:underline">
                          {t.nombre}
                        </Link>
                        {!t.activo && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500">
                            inactiva
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{t.dispositivos_activos}</td>
                      <td className="px-4 py-3">{t.notificaciones_24h}</td>
                      <td className="px-4 py-3">{formatearBytes(t.storage_bytes)}</td>
                      <td className="px-4 py-3">{t.errores_edge_24h}</td>
                      <td className="px-4 py-3">{t.errores_integracion_24h}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  )
}
