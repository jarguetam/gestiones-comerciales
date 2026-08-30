import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { quetzales } from '../../lib/formato'
import { mensajeToast } from '../../lib/erroresUi'
import {
  Badge,
  Button,
  EmptyState,
  FilterChips,
  PageHeader,
  PAGE,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  toneDeEstado,
} from '../../components/ui'
import { useToast } from '../../components/ui/Toast'

type EstadoDepo = 'pendiente' | 'confirmado' | 'rechazado'

interface DepositoDemo {
  id: string
  asesor: string
  monto: number
  referencia: string
  estado: EstadoDepo
  fecha: string
}

const FILTROS = ['pendiente', 'confirmado', 'rechazado', 'todos'] as const

export function DepositosPage() {
  const { fuente } = useDominio()
  const { push } = useToast()
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('pendiente')
  const [items, setItems] = useState<DepositoDemo[]>([])

  useEffect(() => {
    if (fuente !== 'supabase') return
    void supabase
      .from('deposito')
      .select('id, monto, referencia, estado, creado_en, usuario:asesor_id(nombre)')
      .order('creado_en', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data?.length) {
          setItems([])
          return
        }
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
    const { error } = await supabase.rpc('deposito_confirmar', { p_id: Number(id), p_estado: estado })
    if (error) {
      const t = mensajeToast(error)
      push({ tone: 'error', titulo: t.titulo, descripcion: t.descripcion })
      return
    }
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, estado } : d)))
    push({ tone: 'success', titulo: `Depósito ${estado}` })
  }

  return (
    <div className={PAGE}>
      <PageHeader spec="W-07" title="Depósitos" description="Pendientes y confirmados. Confirmación vía deposito_confirmar." />
      <FilterChips opciones={FILTROS} valor={filtro} onChange={setFiltro} />
      {visibles.length === 0 ? (
        <EmptyState titulo="No hay depósitos" descripcion="Cuando el módulo esté activo, los depósitos pendientes aparecen aquí." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Fecha</Th>
              <Th>Asesor</Th>
              <Th>Referencia</Th>
              <Th>Monto</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </THead>
          <TBody>
            {visibles.map((d) => (
              <Tr key={d.id}>
                <Td className="text-muted">{d.fecha}</Td>
                <Td className="font-medium">{d.asesor}</Td>
                <Td>{d.referencia}</Td>
                <Td>{quetzales(d.monto)}</Td>
                <Td>
                  <Badge tone={toneDeEstado(d.estado)}>{d.estado}</Badge>
                </Td>
                <Td className="text-right space-x-2">
                  {d.estado === 'pendiente' && (
                    <>
                      <Button variant="ghost" size="sm" className="text-emerald-800" onClick={() => void confirmar(d.id, 'confirmado')}>
                        Confirmar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-rose-700" onClick={() => void confirmar(d.id, 'rechazado')}>
                        Rechazar
                      </Button>
                    </>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
