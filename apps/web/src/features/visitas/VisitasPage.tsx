import { useState } from 'react'
import { useDominio } from '../../app/DominioContext'

const ESTADOS = ['todas', 'programada', 'completada', 'aprobada', 'rechazada', 'anulada'] as const

export function VisitasPage() {
  const { eventos, abrirNuevaVisita } = useDominio()
  const [filtro, setFiltro] = useState<(typeof ESTADOS)[number]>('todas')
  const visibles =
    filtro === 'todas' ? eventos : eventos.filter((e) => (e.estado ?? 'programada') === filtro)

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-03</p>
          <h2 className="font-serif text-3xl">Visitas</h2>
          <p className="text-sm text-slate-600">{visibles.length} registros</p>
        </div>
        <button
          type="button"
          onClick={() => abrirNuevaVisita()}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Nueva visita
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setFiltro(e)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filtro === e ? 'bg-brand-700 text-white' : 'bg-white border border-[#E4DCC8] text-slate-600'
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E4DCC8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#EFE8D8] text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Visita</th>
              <th className="px-4 py-3 hidden md:table-cell">Cliente</th>
              <th className="px-4 py-3 hidden lg:table-cell">Lugar</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibles.map((v) => (
              <tr key={v.id} className="hover:bg-[#F8F4EA]">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {v.date}
                  <span className="block text-[11px]">{v.startTime}</span>
                </td>
                <td className="px-4 py-3 font-medium">{v.title}</td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-600">{v.personaName ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-500 truncate max-w-xs">
                  {v.location ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize">
                    {v.estado ?? 'programada'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
