import { useEffect, useMemo, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'

const ESTADOS = ['todas', 'borrador', 'enviada', 'firmada', 'aprobada', 'rechazada'] as const

interface SolicitudDemo {
  id: string
  persona: string
  estado: string
  monto: number
  descripcion: string
  fecha: string
  pdf?: string
}

const DEMO: SolicitudDemo[] = [
  { id: 's1', persona: 'Finca El Roble', estado: 'enviada', monto: 25000, descripcion: 'Crédito avío ciclo 2026', fecha: '2026-08-20' },
  { id: 's2', persona: 'Cooperativa La Esperanza', estado: 'firmada', monto: 48000, descripcion: 'Renovación de línea', fecha: '2026-08-18', pdf: 'documentos/demo/s2.pdf' },
  { id: 's3', persona: 'Agropecuaria Sur', estado: 'borrador', monto: 12000, descripcion: 'Capital de trabajo', fecha: '2026-08-25' },
  { id: 's4', persona: 'Distribuidora Norte', estado: 'aprobada', monto: 80000, descripcion: 'Ampliación de cupo', fecha: '2026-08-10', pdf: 'documentos/demo/s4.pdf' },
]

function quetzales(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n)
}

export function SolicitudesPage() {
  const { fuente, personas } = useDominio()
  const [filtro, setFiltro] = useState<(typeof ESTADOS)[number]>('todas')
  const [items, setItems] = useState<SolicitudDemo[]>(DEMO)
  const [detalle, setDetalle] = useState<SolicitudDemo | null>(null)

  useEffect(() => {
    if (DEMO_MODE || fuente === 'demo') return
    void supabase
      .from('solicitud')
      .select('id, descripcion, monto, creado_en, persona(nombre), solicitud_estado(codigo), solicitud_firma(pdf_ruta)')
      .order('creado_en', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data?.length) return
        setItems(
          data.map((s) => {
            const persona = s.persona as { nombre?: string } | { nombre?: string }[] | null
            const estado = s.solicitud_estado as { codigo?: string } | { codigo?: string }[] | null
            const firma = s.solicitud_firma as { pdf_ruta?: string } | { pdf_ruta?: string }[] | null
            const p = Array.isArray(persona) ? persona[0] : persona
            const e = Array.isArray(estado) ? estado[0] : estado
            const f = Array.isArray(firma) ? firma[0] : firma
            return {
              id: String(s.id),
              persona: p?.nombre ?? '—',
              estado: e?.codigo ?? 'borrador',
              monto: Number(s.monto ?? 0),
              descripcion: String(s.descripcion),
              fecha: String(s.creado_en).slice(0, 10),
              pdf: f?.pdf_ruta,
            }
          }),
        )
      })
  }, [fuente])

  const visibles = useMemo(
    () => (filtro === 'todas' ? items : items.filter((s) => s.estado === filtro)),
    [filtro, items],
  )

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-06</p>
        <h2 className="font-serif text-3xl">Solicitudes</h2>
        <p className="text-sm text-slate-600">
          Bandeja por estado del flujo. {visibles.length} registros
          {personas.length ? ` · cartera ${personas.length}` : ''}
        </p>
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
              <th className="px-4 py-3">Persona</th>
              <th className="px-4 py-3 hidden md:table-cell">Descripción</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibles.map((s) => (
              <tr
                key={s.id}
                className="hover:bg-[#F8F4EA] cursor-pointer"
                onClick={() => setDetalle(s)}
              >
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.fecha}</td>
                <td className="px-4 py-3 font-medium">{s.persona}</td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-600">{s.descripcion}</td>
                <td className="px-4 py-3">{quetzales(s.monto)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize">
                    {s.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="rounded-2xl border border-[#E4DCC8] bg-white p-5">
          <div className="flex justify-between gap-3">
            <h3 className="font-serif text-xl">{detalle.persona}</h3>
            <button type="button" className="text-sm text-slate-500" onClick={() => setDetalle(null)}>
              Cerrar
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">{detalle.descripcion}</p>
          <p className="mt-2 text-sm">
            Monto {quetzales(detalle.monto)} · estado <strong className="capitalize">{detalle.estado}</strong>
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Archivos y firma: {detalle.pdf ? `PDF ${detalle.pdf}` : 'sin PDF todavía. La firma (PNG) dispara pdf-solicitud.'}
          </p>
        </div>
      )}
    </div>
  )
}
