import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDominio } from '../../app/DominioContext'
import { useAuth } from '../auth/useAuth'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import {
  demoFilasDashboard,
  filasDelEquipo,
  kpisDeFilas,
  puedeDrillDown,
  rankingSupervisores,
  type FilaDashboard,
} from './dashboard'

const ESTILO_KPI = 'rounded-2xl bg-white border border-[#E4DCC8] p-5 shadow-sm'

function filaDeRpc(row: Record<string, unknown>): FilaDashboard {
  return {
    usuario_id: String(row.usuario_id),
    nombre: String(row.nombre ?? '—'),
    rol: String(row.rol ?? ''),
    jefe_id: row.jefe_id != null ? String(row.jefe_id) : null,
    visitas_programadas: Number(row.visitas_programadas ?? 0),
    visitas_completadas: Number(row.visitas_completadas ?? 0),
    visitas_aprobadas: Number(row.visitas_aprobadas ?? 0),
    visitas_rechazadas: Number(row.visitas_rechazadas ?? 0),
    total_personas: row.total_personas != null ? Number(row.total_personas) : undefined,
  }
}

export function DashboardHome() {
  const { eventos, personas, leads, tenantNombre, abrirNuevaVisita, fuente, modulos } = useDominio()
  const { rol } = useAuth()
  const live = !DEMO_MODE && fuente === 'supabase'
  const [filas, setFilas] = useState<FilaDashboard[]>(demoFilasDashboard())
  const [supervisorId, setSupervisorId] = useState('')
  const [depositosPendientes, setDepositosPendientes] = useState(2)
  const [cuentasMora, setCuentasMora] = useState(1)

  useEffect(() => {
    if (!live) {
      setFilas(demoFilasDashboard())
      return
    }
    const rpc = rol === 'supervisor' ? 'dashboard_supervisor' : 'dashboard_gerente'
    void supabase.rpc(rpc).then(({ data, error }) => {
      if (error || !Array.isArray(data) || data.length === 0) return
      setFilas((data as Record<string, unknown>[]).map(filaDeRpc))
    })
    if (modulos.includes('depositos')) {
      void supabase
        .from('deposito')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente')
        .then(({ count }) => {
          if (typeof count === 'number') setDepositosPendientes(count)
        })
    }
    if (modulos.includes('creditos')) {
      void supabase
        .from('cuenta')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'mora')
        .then(({ count }) => {
          if (typeof count === 'number') setCuentasMora(count)
        })
    }
  }, [live, rol, modulos])

  const drill = puedeDrillDown(rol, DEMO_MODE)
  const visibles = useMemo(
    () => filasDelEquipo(filas, drill && supervisorId ? supervisorId : null),
    [filas, drill, supervisorId],
  )
  const kpis = kpisDeFilas(visibles)
  const ranking = rankingSupervisores(filas)
  const supervisores = filas.filter((f) => f.rol === 'supervisor')
  const leadsAbiertos = leads.filter((l) => !l.convertido && l.estadoCodigo !== 'perdido').length
  const hoy = eventos.slice(0, 5)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">
            {drill ? 'W-02b · Gerencial' : 'W-02 · Operación'}
          </p>
          <h2 className="font-serif text-3xl mt-1">Tablero de {tenantNombre}</h2>
          <p className="text-sm text-slate-600 mt-1">
            KPIs del día con alcance por rol. El drill-down refiltra visitas y ranking de equipos.
          </p>
        </div>
        {drill && supervisores.length > 0 && (
          <label className="text-sm text-slate-600">
            Equipo{' '}
            <select
              aria-label="Filtrar por supervisor"
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5"
            >
              <option value="">Todos</option>
              {supervisores.map((s) => (
                <option key={s.usuario_id} value={s.usuario_id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <article className={ESTILO_KPI}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Visitas programadas</p>
          <p className="mt-2 font-serif text-4xl text-brand-800">{kpis.programadas}</p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Completadas</p>
          <p className="mt-2 font-serif text-4xl text-emerald-800">{kpis.pctCompletadas}%</p>
          <p className="text-xs text-slate-500 mt-1">
            {kpis.completadas} de {kpis.visitas} visitas
          </p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Asesores activos</p>
          <p className="mt-2 font-serif text-4xl">{kpis.asesoresActivos}</p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            {modulos.includes('depositos') || DEMO_MODE ? 'Depósitos pendientes' : 'Personas'}
          </p>
          <p className="mt-2 font-serif text-4xl">
            {modulos.includes('depositos') || DEMO_MODE ? depositosPendientes : personas.length}
          </p>
        </article>
      </section>

      {(modulos.includes('creditos') || DEMO_MODE) && (
        <p className="text-sm text-slate-600">
          Cuentas en mora: <span className="font-semibold">{cuentasMora}</span>
          {leadsAbiertos ? ` · Leads abiertos ${leadsAbiertos}` : ''}
        </p>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-[#E4DCC8] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Próximas visitas</h3>
            <Link to="/visitas" className="text-sm text-brand-700 font-medium">
              Ver todas
            </Link>
          </div>
          <ul className="space-y-2">
            {hoy.map((v) => (
              <li key={v.id} className="rounded-xl border border-slate-100 px-3 py-2">
                <p className="text-sm font-medium truncate">{v.title}</p>
                <p className="text-xs text-slate-500">
                  {v.date} · {v.startTime}
                  {v.personaName ? ` · ${v.personaName}` : ''}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => abrirNuevaVisita()}
            className="mt-4 text-sm font-semibold text-brand-700"
          >
            + Nueva visita
          </button>
        </div>

        <div className="rounded-2xl bg-white border border-[#E4DCC8] p-5">
          <h3 className="font-semibold mb-3">Ranking de equipos</h3>
          {ranking.length === 0 ? (
            <ul className="space-y-2">
              {['nuevo', 'contactado', 'calificado', 'ganado', 'perdido'].map((codigo) => {
                const n = leads.filter((l) => l.estadoCodigo === codigo).length
                return (
                  <li key={codigo} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-slate-600">{codigo}</span>
                    <span className="font-semibold">{n}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <ol className="space-y-2">
              {ranking.map((r, i) => (
                <li key={r.usuario_id} className="flex items-center justify-between text-sm">
                  <span>
                    {i + 1}. {r.nombre}
                  </span>
                  <span className="font-semibold">{r.completadas} completadas</span>
                </li>
              ))}
            </ol>
          )}
          <Link to="/crm" className="mt-4 inline-block text-sm text-brand-700 font-medium">
            Abrir pipeline
          </Link>
        </div>
      </section>
    </div>
  )
}
