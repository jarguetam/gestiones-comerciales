import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDominio } from '../../app/DominioContext'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../lib/supabase'
import {
  filasDelEquipo,
  kpisDeFilas,
  puedeDrillDown,
  rankingSupervisores,
  specIdsDashboard,
  type FilaDashboard,
} from './dashboard'
import { Button, PageHeader, PAGE, Select, KpiSkeleton } from '../../components/ui'

const ESTILO_KPI = 'rounded-lg bg-surface border border-line p-4'

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
  const live = fuente === 'supabase'
  const [filas, setFilas] = useState<FilaDashboard[]>([])
  const [supervisorId, setSupervisorId] = useState('')
  const [depositosPendientes, setDepositosPendientes] = useState(0)
  const [cuentasMora, setCuentasMora] = useState(0)
  const [cargandoKpi, setCargandoKpi] = useState(live)

  useEffect(() => {
    if (!live) {
      setFilas([])
      setCargandoKpi(false)
      return
    }
    setCargandoKpi(true)
    const rpc = rol === 'supervisor' ? 'dashboard_supervisor' : 'dashboard_gerente'
    void supabase.rpc(rpc).then(({ data, error }) => {
      if (!error && Array.isArray(data) && data.length > 0) {
        setFilas((data as Record<string, unknown>[]).map(filaDeRpc))
      }
      setCargandoKpi(false)
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

  const drill = puedeDrillDown(rol)
  const specs = specIdsDashboard(rol)
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
    <div className={PAGE}>
      <PageHeader
        spec={specs.pagina}
        title={`Tablero de ${tenantNombre}`}
        description="KPIs del día con alcance por rol. El drill-down refiltra visitas y ranking de equipos."
        actions={
          specs.drill && supervisores.length > 0 ? (
            <div data-spec={specs.drill}>
              <Select
                id="filtro-supervisor"
                label="Equipo"
                aria-label="Filtrar por supervisor"
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
              >
                <option value="">Todos</option>
                {supervisores.map((s) => (
                  <option key={s.usuario_id} value={s.usuario_id}>
                    {s.nombre}
                  </option>
                ))}
              </Select>
            </div>
          ) : undefined
        }
      />

      {cargandoKpi ? (
        <KpiSkeleton />
      ) : (
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <article className={ESTILO_KPI}>
          <p className="text-xs text-muted">Visitas programadas</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{kpis.programadas}</p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-xs text-muted">Completadas</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{kpis.pctCompletadas}%</p>
          <p className="text-xs text-muted mt-1">
            {kpis.completadas} de {kpis.visitas} visitas
          </p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-xs text-muted">Asesores activos</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{kpis.asesoresActivos}</p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-xs text-muted">
            {modulos.includes('depositos') ? 'Depósitos pendientes' : 'Personas'}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
            {modulos.includes('depositos') ? depositosPendientes : personas.length}
          </p>
        </article>
      </section>
      )}

      {modulos.includes('creditos') && (
        <p className="text-sm text-muted">
          Cuentas en mora: <span className="font-semibold text-ink">{cuentasMora}</span>
          {leadsAbiertos ? ` · Leads abiertos ${leadsAbiertos}` : ''}
        </p>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg bg-surface border border-line p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Próximas visitas</h3>
            <Link to="/visitas" className="text-sm text-primary font-medium">
              Ver todas
            </Link>
          </div>
          <ul className="space-y-2">
            {hoy.map((v) => (
              <li key={v.id} className="rounded-md border border-line px-3 py-2">
                <p className="text-sm font-medium truncate">{v.title}</p>
                <p className="text-xs text-muted">
                  {v.date} · {v.startTime}
                  {v.personaName ? ` · ${v.personaName}` : ''}
                </p>
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="mt-4 px-0" onClick={() => abrirNuevaVisita()}>
            + Nueva visita
          </Button>
        </div>

        <div className="rounded-lg bg-surface border border-line p-4">
          <h3 className="font-semibold mb-3">Ranking de equipos</h3>
          {ranking.length === 0 ? (
            <ul className="space-y-2">
              {['nuevo', 'contactado', 'calificado', 'ganado', 'perdido'].map((codigo) => {
                const n = leads.filter((l) => l.estadoCodigo === codigo).length
                return (
                  <li key={codigo} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted">{codigo}</span>
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
          <Link to="/crm" className="mt-4 inline-block text-sm text-primary font-medium">
            Abrir pipeline
          </Link>
        </div>
      </section>
    </div>
  )
}
