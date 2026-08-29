import { useEffect, useMemo, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { quetzales } from '../../lib/formato'
import {
  Badge,
  EmptyState,
  Input,
  PageHeader,
  PAGE,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../components/ui'

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
    <div className={PAGE}>
      <PageHeader
        spec="W-08"
        title="Cuentas y movimientos"
        description={`Cartera, saldo y mora (${visibles.length}). Solo lectura; los movimientos llegan por ingesta.${personas.length ? ` · ${personas.length} personas en cartera` : ''}`}
      />
      <Input
        id="buscar-cuenta"
        label="Buscar"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por persona, contrato o producto"
        className="max-w-md"
      />
      {visibles.length === 0 ? (
        <EmptyState titulo="No hay cuentas" descripcion="Cuando el módulo de créditos esté activo, la cartera aparece aquí." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Contrato</Th>
              <Th>Persona</Th>
              <Th className="hidden md:table-cell">Producto</Th>
              <Th>Monto</Th>
              <Th>Mora</Th>
              <Th>Riesgo</Th>
            </tr>
          </THead>
          <TBody>
            {visibles.map((c) => (
              <Tr key={c.id}>
                <Td className="font-mono text-xs">{c.codigo}</Td>
                <Td className="font-medium">{c.persona}</Td>
                <Td className="hidden md:table-cell">{c.producto}</Td>
                <Td>{quetzales(c.monto)}</Td>
                <Td>
                  <Badge tone={c.diasAtraso > 0 ? 'danger' : 'success'}>
                    {c.diasAtraso > 0 ? `${c.diasAtraso}d · ${c.rangoMora}` : 'al día'}
                  </Badge>
                </Td>
                <Td>{quetzales(c.capitalRiesgo)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
