import { useEffect, useMemo, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'

interface CuentaDemo {
  id: string
  persona: string
  codigo: string
  producto: string
  monto: number
  estado: string
  diasAtraso: number
  rangoMora: string
  capitalRiesgo: number
}

const DEMO: CuentaDemo[] = [
  { id: 'c1', persona: 'Finca El Roble', codigo: 'C0021290', producto: 'Avío', monto: 45000, estado: 'mora', diasAtraso: 42, rangoMora: '31-60', capitalRiesgo: 18000 },
  { id: 'c2', persona: 'Cooperativa La Esperanza', codigo: 'C0021301', producto: 'Inversión', monto: 80000, estado: 'activa', diasAtraso: 0, rangoMora: '—', capitalRiesgo: 0 },
  { id: 'c3', persona: 'Agropecuaria Sur', codigo: 'C0021188', producto: 'Avío', monto: 12500, estado: 'activa', diasAtraso: 12, rangoMora: '1-30', capitalRiesgo: 3200 },
]

function quetzales(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n)
}

export function CuentasPage() {
  const { fuente, personas } = useDominio()
  const [items, setItems] = useState<CuentaDemo[]>(DEMO)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (DEMO_MODE || fuente === 'demo') return
    void supabase
      .from('cuenta')
      .select('id, codigo_externo, monto, estado, persona(nombre), producto(nombre), cuenta_saldo(dias_atraso, rango_mora, capital_riesgo, corte_en)')
      .eq('activo', true)
      .limit(200)
      .then(({ data }) => {
        if (!data?.length) return
        setItems(
          data.map((c) => {
            const persona = c.persona as { nombre?: string } | { nombre?: string }[] | null
            const producto = c.producto as { nombre?: string } | { nombre?: string }[] | null
            const saldos = c.cuenta_saldo as Array<{
              dias_atraso?: number
              rango_mora?: string
              capital_riesgo?: number
              corte_en?: string
            }> | null
            const p = Array.isArray(persona) ? persona[0] : persona
            const pr = Array.isArray(producto) ? producto[0] : producto
            const ultimo = [...(saldos ?? [])].sort((a, b) => String(b.corte_en).localeCompare(String(a.corte_en)))[0]
            return {
              id: String(c.id),
              persona: p?.nombre ?? '—',
              codigo: String(c.codigo_externo),
              producto: pr?.nombre ?? '—',
              monto: Number(c.monto),
              estado: String(c.estado),
              diasAtraso: ultimo?.dias_atraso ?? 0,
              rangoMora: ultimo?.rango_mora ?? '—',
              capitalRiesgo: Number(ultimo?.capital_riesgo ?? 0),
            }
          }),
        )
      })
  }, [fuente])

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return items
    return items.filter(
      (c) =>
        c.persona.toLowerCase().includes(t) ||
        c.codigo.toLowerCase().includes(t) ||
        c.producto.toLowerCase().includes(t),
    )
  }, [items, q])

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-08</p>
        <h2 className="font-serif text-3xl">Cuentas y movimientos</h2>
        <p className="text-sm text-slate-600">
          Cartera, saldo y mora ({visibles.length}). Solo lectura; los movimientos llegan por ingesta.
          {personas.length ? ` · ${personas.length} personas en cartera` : ''}
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por persona, contrato o producto"
        className="w-full max-w-md rounded-lg border border-[#E4DCC8] bg-white px-3 py-2 text-sm"
      />

      <div className="overflow-hidden rounded-2xl border border-[#E4DCC8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#EFE8D8] text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Contrato</th>
              <th className="px-4 py-3">Persona</th>
              <th className="px-4 py-3 hidden md:table-cell">Producto</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Mora</th>
              <th className="px-4 py-3">Riesgo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibles.map((c) => (
              <tr key={c.id} className="hover:bg-[#F8F4EA]">
                <td className="px-4 py-3 font-mono text-xs">{c.codigo}</td>
                <td className="px-4 py-3 font-medium">{c.persona}</td>
                <td className="px-4 py-3 hidden md:table-cell">{c.producto}</td>
                <td className="px-4 py-3">{quetzales(c.monto)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.diasAtraso > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
                    {c.diasAtraso > 0 ? `${c.diasAtraso}d · ${c.rangoMora}` : 'al día'}
                  </span>
                </td>
                <td className="px-4 py-3">{quetzales(c.capitalRiesgo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
