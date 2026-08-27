import { Link } from 'react-router-dom'
import { useDominio } from '../../app/DominioContext'

const ESTILO_KPI = 'rounded-2xl bg-white border border-[#E4DCC8] p-5 shadow-sm'

export function DashboardHome() {
  const { eventos, personas, leads, tenantNombre, abrirNuevaVisita } = useDominio()
  const programadas = eventos.filter((e) => (e.estado ?? 'programada') === 'programada').length
  const completadas = eventos.filter((e) => e.estado === 'completada' || e.completed).length
  const leadsAbiertos = leads.filter((l) => !l.convertido && l.estadoCodigo !== 'perdido').length
  const hoy = eventos.slice(0, 5)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-02 · Operación</p>
        <h2 className="font-serif text-3xl mt-1">Tablero de {tenantNombre}</h2>
        <p className="text-sm text-slate-600 mt-1">
          Visitas, cartera y embudo en un solo lugar. Los módulos de rubro (F3) se activan por tenant.
        </p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <article className={ESTILO_KPI}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Visitas programadas</p>
          <p className="mt-2 font-serif text-4xl text-brand-800">{programadas}</p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Completadas</p>
          <p className="mt-2 font-serif text-4xl text-emerald-800">{completadas}</p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Personas</p>
          <p className="mt-2 font-serif text-4xl">{personas.length}</p>
        </article>
        <article className={ESTILO_KPI}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Leads abiertos</p>
          <p className="mt-2 font-serif text-4xl">{leadsAbiertos}</p>
        </article>
      </section>

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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Embudo CRM</h3>
            <Link to="/crm" className="text-sm text-brand-700 font-medium">
              Abrir pipeline
            </Link>
          </div>
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
        </div>
      </section>
    </div>
  )
}
