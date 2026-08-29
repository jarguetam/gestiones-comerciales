import { useEffect, useState, type FormEvent } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { Alert, Button, Input, PageHeader, PAGE, Table, TBody, Td, Th, THead, Tr } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { mensajeToast } from '../../lib/erroresUi'

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
  const { push } = useToast()
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
      push({ tone: 'error', titulo: 'Kilómetros inválidos' })
      return
    }
    if (DEMO_MODE || fuente === 'demo') {
      if (kf < ki) {
        setAviso('GC-KM-001: km_final no puede ser menor que km_inicial')
        push({ tone: 'error', titulo: 'km_final no puede ser menor que km_inicial', descripcion: 'GC-KM-001' })
        return
      }
      setItems((prev) => {
        const yo = prev.find((x) => x.asesor === 'Tú (demo)')
        if (yo) return prev.map((x) => (x.id === yo.id ? { ...x, kmInicial: ki, kmFinal: kf } : x))
        return [{ id: 'k-demo', asesor: 'Tú (demo)', periodo: PERIODO_DEMO, kmInicial: ki, kmFinal: kf }, ...prev]
      })
      setAviso('Kilometraje del mes registrado (demo)')
      push({ tone: 'success', titulo: 'Kilometraje del mes registrado (demo)' })
      return
    }
    const { error } = await supabase.rpc('km_registrar', {
      p_periodo: PERIODO_DEMO,
      p_km_inicial: ki,
      p_km_final: kf,
    })
    if (error) {
      const t = mensajeToast(error)
      setAviso(error.message)
      push({ tone: 'error', titulo: t.titulo, descripcion: t.descripcion })
    } else {
      setAviso('Kilometraje del mes registrado')
      push({ tone: 'success', titulo: 'Kilometraje del mes registrado' })
    }
  }

  return (
    <div className={PAGE}>
      <PageHeader spec="W-09" title="Kilometraje" description={<span className="capitalize">Carga del mes · {mesLabel(PERIODO_DEMO)}</span>} />

      <form onSubmit={(e) => void registrar(e)} className="rounded-2xl border border-line bg-surface p-5 flex flex-wrap gap-3 items-end">
        <Input id="km-inicial" label="Km inicial" value={inicial} onChange={(e) => setInicial(e.target.value)} type="number" step="0.1" className="w-32" />
        <Input id="km-final" label="Km final" value={finalKm} onChange={(e) => setFinalKm(e.target.value)} type="number" step="0.1" className="w-32" />
        <Button type="submit">Registrar periodo</Button>
        {aviso && <Alert tone={aviso.startsWith('GC-') ? 'danger' : 'success'}>{aviso}</Alert>}
      </form>

      <Table>
        <THead>
          <tr>
            <Th>Asesor</Th>
            <Th>Periodo</Th>
            <Th>Km inicial</Th>
            <Th>Km final</Th>
            <Th>Recorrido</Th>
          </tr>
        </THead>
        <TBody>
          {items.map((k) => (
            <Tr key={k.id}>
              <Td className="font-medium">{k.asesor}</Td>
              <Td className="capitalize">{mesLabel(k.periodo)}</Td>
              <Td>{k.kmInicial}</Td>
              <Td>{k.kmFinal}</Td>
              <Td className="font-semibold">{(k.kmFinal - k.kmInicial).toFixed(1)} km</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  )
}
