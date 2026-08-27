import { useEffect, useState, type FormEvent } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'

interface KmDemo {
  id: string
  asesor: string
  periodo: string
  kmInicial: number
  kmFinal: number
}

const PERIODO_DEMO = '2026-08-01'

const DEMO: KmDemo[] = [
  { id: 'k1', asesor: 'Asesor A', periodo: PERIODO_DEMO, kmInicial: 12450, kmFinal: 13120 },
  { id: 'k2', asesor: 'Asesor B', periodo: PERIODO_DEMO, kmInicial: 8800, kmFinal: 9105 },
  { id: 'k3', asesor: 'Asesor C', periodo: PERIODO_DEMO, kmInicial: 15200, kmFinal: 15200 },
]

function mesLabel(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
}

export function KilometrajePage() {
  const { fuente } = useDominio()
  const [items, setItems] = useState<KmDemo[]>(DEMO)
  const [inicial, setInicial] = useState('0')
  const [finalKm, setFinalKm] = useState('0')
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (DEMO_MODE || fuente === 'demo') return
    void supabase
      .from('kilometraje')
      .select('id, periodo, km_inicial, km_final, usuario:usuario_id(nombre)')
      .order('periodo', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data?.length) return
        setItems(
          data.map((k) => {
            const u = k.usuario as { nombre?: string } | { nombre?: string }[] | null
            const nombre = Array.isArray(u) ? u[0]?.nombre : u?.nombre
            return {
              id: String(k.id),
              asesor: nombre ?? '—',
              periodo: String(k.periodo),
              kmInicial: Number(k.km_inicial ?? 0),
              kmFinal: Number(k.km_final ?? 0),
            }
          }),
        )
      })
  }, [fuente])

  async function registrar(e: FormEvent) {
    e.preventDefault()
    const ki = Number(inicial)
    const kf = Number(finalKm)
    if (Number.isNaN(ki) || Number.isNaN(kf)) {
      setAviso('Kilómetros inválidos')
      return
    }
    if (DEMO_MODE || fuente === 'demo') {
      if (kf < ki) {
        setAviso('GC-KM-001: km_final no puede ser menor que km_inicial')
        return
      }
      setItems((prev) => {
        const yo = prev.find((x) => x.asesor === 'Tú (demo)')
        if (yo) return prev.map((x) => (x.id === yo.id ? { ...x, kmInicial: ki, kmFinal: kf } : x))
        return [{ id: 'k-demo', asesor: 'Tú (demo)', periodo: PERIODO_DEMO, kmInicial: ki, kmFinal: kf }, ...prev]
      })
      setAviso('Kilometraje del mes registrado (demo)')
      return
    }
    const { error } = await supabase.rpc('km_registrar', {
      p_periodo: PERIODO_DEMO,
      p_km_inicial: ki,
      p_km_final: kf,
    })
    setAviso(error ? error.message : 'Kilometraje del mes registrado')
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-09</p>
        <h2 className="font-serif text-3xl">Kilometraje</h2>
        <p className="text-sm text-slate-600 capitalize">Carga del mes · {mesLabel(PERIODO_DEMO)}</p>
      </div>

      <form
        onSubmit={(e) => void registrar(e)}
        className="rounded-2xl border border-[#E4DCC8] bg-white p-5 flex flex-wrap gap-3 items-end"
      >
        <label className="text-sm">
          <span className="block text-[11px] uppercase tracking-wide text-slate-500">Km inicial</span>
          <input
            value={inicial}
            onChange={(e) => setInicial(e.target.value)}
            type="number"
            step="0.1"
            className="mt-1 rounded-lg border border-[#E4DCC8] px-3 py-2 w-32"
          />
        </label>
        <label className="text-sm">
          <span className="block text-[11px] uppercase tracking-wide text-slate-500">Km final</span>
          <input
            value={finalKm}
            onChange={(e) => setFinalKm(e.target.value)}
            type="number"
            step="0.1"
            className="mt-1 rounded-lg border border-[#E4DCC8] px-3 py-2 w-32"
          />
        </label>
        <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
          Registrar periodo
        </button>
        {aviso && <p className="text-sm text-brand-800">{aviso}</p>}
      </form>

      <div className="overflow-hidden rounded-2xl border border-[#E4DCC8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#EFE8D8] text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Asesor</th>
              <th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3">Km inicial</th>
              <th className="px-4 py-3">Km final</th>
              <th className="px-4 py-3">Recorrido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((k) => (
              <tr key={k.id} className="hover:bg-[#F8F4EA]">
                <td className="px-4 py-3 font-medium">{k.asesor}</td>
                <td className="px-4 py-3 capitalize">{mesLabel(k.periodo)}</td>
                <td className="px-4 py-3">{k.kmInicial}</td>
                <td className="px-4 py-3">{k.kmFinal}</td>
                <td className="px-4 py-3 font-semibold">{(k.kmFinal - k.kmInicial).toFixed(1)} km</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
