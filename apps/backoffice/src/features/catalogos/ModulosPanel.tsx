import { useState } from 'react'
import { mensajeError, type ModuloCatalogo } from './catalogos'
import { Badge, Button, fieldClass, Table, TBody, Td, Th, THead, Tr } from '../../components/ui'

interface Props {
  modulos: ModuloCatalogo[]
  onChange: (v: ModuloCatalogo[]) => void
  onGuardar: (codigo: string, nombre: string, nucleo: boolean) => Promise<number>
  onError: (v: string | null) => void
  onAviso: (v: string | null) => void
}

export function ModulosPanel({ modulos, onChange, onGuardar, onError, onAviso }: Props) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [nucleo, setNucleo] = useState(false)

  async function alta() {
    const c = codigo.trim().toLowerCase()
    const n = nombre.trim()
    if (!c || !n) return
    onError(null)
    try {
      const id = await onGuardar(c, n, nucleo)
      const resto = modulos.filter((m) => m.codigo !== c)
      onChange(
        [...resto, { id, codigo: c, nombre: n, nucleo: c === 'core' ? true : nucleo }].sort(
          (a, b) => Number(b.nucleo) - Number(a.nucleo) || a.codigo.localeCompare(b.codigo),
        ),
      )
      setCodigo('')
      setNombre('')
      setNucleo(false)
      onAviso('Módulo guardado')
    } catch (e) {
      onError(mensajeError(e, 'No se pudo guardar el módulo'))
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void alta()
        }}
        className="rounded-2xl border border-line bg-surface p-4 grid gap-3 md:grid-cols-4"
      >
        <h3 className="md:col-span-4 font-medium">Nuevo módulo optativo</h3>
        <input
          id="modulo-codigo"
          aria-label="Código del módulo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="código (crm)"
          className={fieldClass}
        />
        <input
          id="modulo-nombre"
          aria-label="Nombre del módulo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre visible"
          className={`md:col-span-2 ${fieldClass}`}
        />
        <label htmlFor="modulo-nucleo" className="flex items-center gap-2 text-sm text-ink">
          <input
            id="modulo-nucleo"
            type="checkbox"
            checked={nucleo}
            onChange={(e) => setNucleo(e.target.checked)}
          />
          Núcleo
        </label>
        <Button type="submit">Guardar</Button>
      </form>

      <Table>
        <THead>
          <tr>
            <Th>Código</Th>
            <Th>Nombre</Th>
            <Th>Tipo</Th>
          </tr>
        </THead>
        <TBody>
          {modulos.map((m) => (
            <Tr key={m.codigo}>
              <Td className="font-mono text-xs">{m.codigo}</Td>
              <Td>{m.nombre}</Td>
              <Td>
                <Badge tone={m.nucleo ? 'primary' : 'neutral'}>{m.nucleo ? 'núcleo' : 'optativo'}</Badge>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  )
}
