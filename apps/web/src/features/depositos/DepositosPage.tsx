import { useEffect, useMemo, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'

type EstadoDepo = 'pendiente' | 'confirmado' | 'rechazado'

interface DepositoDemo {
  id: string
  asesor: string
  monto: number
  referencia: string
  estado: EstadoDepo
  fecha: string
}

const DEMO: DepositoDemo[] = [
  { id: 'd1', asesor: 'Asesor A', monto: 2500, referencia: 'BOLETA-1044', estado: 'pendiente', fecha: '2026-08-26' },
  { id: 'd2', asesor: 'Asesor B', monto: 1800, referencia: 'TRX-8891', estado: 'pendiente', fecha: '2026-08-25' },
  { id: 'd3', asesor: 'Asesor A', monto: 4200, referencia: 'BOLETA-1030', estado: 'confirmado', fecha: '2026-08-22' },
  { id: 'd4', asesor: 'Asesor C', monto: 900, referencia: 'BOLETA-1021', estado: 'rechazado', fecha: '2026-08-19' },
]

function quetzales(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n)
}

export function DepositosPage() {
  const { fuente } = useDominio()
  const [filtro, setFiltro] = useState<'todos' | EstadoDepo>('pendiente')
  const [items, setItems] = useState<DepositoDemo[]>(DEMO)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (DEMO_MODE || fuente === 'demo') return
    void supabase
      .from('deposito')
      .select('id, monto, referencia, estado, creado_en, usuario:asesor_id(nombre)')
      .order('creado_en', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data?.length) return
        setItems(
          data.map((d) => {
            const u = d.usuario as { nombre?: string } | { nombre?: string }[] | null
            const nombre = Array.isArray(u) ? u[0]?.nombre : u?.nombre
            return {
              id: String(d.id),
              asesor: nombre ?? '—',
              monto: Number(d.monto),
              referencia: String(d.referencia ?? '—'),
              estado: d.estado as EstadoDepo,
              fecha: String(d.creado_en).slice(0, 10),
            }
          }),
        )
      })
  }, [fuente])

  const visibles = useMemo(
    () => (filtro === 'todos' ? items : items.filter((d) => d.estado === filtro)),
    [filtro, items],
  )

  async function confirmar(id: string, estado: 'confirmado' | 'rechazado') {
    if (DEMO_MODE || fuente === 'demo') {
      setItems((prev) => prev.map((d) => (d.id === id ? { ...d, estado } : d)))
      setAviso(`Depósito ${estado} (demo)`)
      return
    }
    const { error } = await supabase.rpc('deposito_confirmar', { p_id: Number(id), p_estado: estado })
    if (error) {
      setAviso(error.message)
      return
    }
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, estado } : d)))
    setAviso(`Depósito ${estado}`)
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-07</p>
        <h2 className="font-serif text-3xl">Depósitos</h2>
        <p className="text-sm text-slate-600">Pendientes y confirmados. Confirmación vía deposito_confirmar.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['pendiente', 'confirmado', 'rechazado', 'todos'] as const).map((e) => (
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

      {aviso && <p className="text-sm text-brand-800">{aviso}</p>}

      <div className="overflow-hidden rounded-2xl border border-[#E4DCC8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#EFE8D8] text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Asesor</th>
              <th className="px-4 py-3">Referencia</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibles.map((d) => (
              <tr key={d.id} className="hover:bg-[#F8F4EA]">
                <td className="px-4 py-3 text-slate-600">{d.fecha}</td>
                <td className="px-4 py-3 font-medium">{d.asesor}</td>
                <td className="px-4 py-3">{d.referencia}</td>
                <td className="px-4 py-3">{quetzales(d.monto)}</td>
                <td className="px-4 py-3 capitalize">{d.estado}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  {d.estado === 'pendiente' && (
                    <>
                      <button
                        type="button"
                        className="text-xs font-semibold text-emerald-800"
                        onClick={() => void confirmar(d.id, 'confirmado')}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-700"
                        onClick={() => void confirmar(d.id, 'rechazado')}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
