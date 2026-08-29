import { useMemo, useState } from 'react'
import type { CalendarEvent, EventCategory } from '../types'
import { CATALOGO_ACTIVIDADES, CATALOGO_HORAS, INITIAL_ATTENDEES } from '../eventsData'
import { INITIAL_PERSONAS, type PersonaItem } from '../personasData'
import type { CatalogoActividad, CatalogoHora } from '../../../lib/catalogos'
import { errorAltaPersona, mensajeGc } from '../../../lib/persistirHelpers'
import { Alert, Button, Dialog, Input, Select, Textarea, fieldClass } from '../../../components/ui'

interface NewEventModalProps {
  onClose: () => void
  onSave: (event: CalendarEvent) => void | Promise<void>
  onSavePersona?: (persona: PersonaItem) => void | Promise<PersonaItem | void>
  initialDate?: string
  initialPersonaName?: string
  cartera?: PersonaItem[]
  catalogos?: CatalogoActividad[]
  horas?: CatalogoHora[]
}

const CATEGORIAS: EventCategory[] = ['amber', 'lavender', 'mint', 'rose', 'sky']

/**
 * Mapping visual entre actividad del catálogo y la paleta de acentos del template.
 * Verificación=amber · Seguimiento=lavender · Prospección=mint · Recuperación=rose · Cultivo=sky
 */
const ACTIVIDAD_CATEGORIA: Record<number, EventCategory> = {
  1: 'amber',
  2: 'lavender',
  3: 'mint',
  4: 'rose',
  5: 'sky',
}

export function NewEventModal({
  onClose,
  onSave,
  onSavePersona,
  initialDate = '2026-09-17',
  initialPersonaName = '',
  cartera,
  catalogos,
  horas,
}: NewEventModalProps) {
  const catalogo = catalogos && catalogos.length > 0 ? catalogos : CATALOGO_ACTIVIDADES
  const catalogoHoras = horas && horas.length > 0 ? horas : CATALOGO_HORAS
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [actividadId, setActividadId] = useState<number | ''>('')
  const [subActividadId, setSubActividadId] = useState<number | ''>('')
  const [horaId, setHoraId] = useState<number>(catalogoHoras[0]?.id ?? 2)
  const [location, setLocation] = useState('')
  const [videoCall, setVideoCall] = useState('')
  const [notes, setNotes] = useState('')
  const [reminder, setReminder] = useState('20 mins before')
  const carteraInicial = cartera ?? INITIAL_PERSONAS
  const [personas, setPersonas] = useState<PersonaItem[]>(carteraInicial)
  const [personaId, setPersonaId] = useState<string>(
    carteraInicial.some((p) => p.nombre === initialPersonaName) ? initialPersonaName : ''
  )
  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevaCategoria, setNuevaCategoria] = useState('Prospecto — En evaluación')
  const [nuevoDocumento, setNuevoDocumento] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [nuevaDireccion, setNuevaDireccion] = useState('')
  const [errorPersona, setErrorPersona] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const actividadSeleccionada = useMemo(
    () => catalogo.find((a) => a.id === actividadId),
    [catalogo, actividadId]
  )
  const subActividadSeleccionada = useMemo(
    () => actividadSeleccionada?.sub_actividades.find((sa) => sa.id === subActividadId),
    [actividadSeleccionada, subActividadId]
  )

  function handleActividadChange(value: string) {
    const id = value === '' ? '' : Number(value)
    setActividadId(id)
    setSubActividadId('') // reset dependiente: la subactividad debe pertenecer a la actividad
  }

  const personaSeleccionada = personas.find((p) => p.nombre === personaId)

  /** Registra un nuevo cliente en la cartera y lo selecciona para la visita. */
  async function handleRegistrarPersona(e?: React.FormEvent) {
    e?.preventDefault()
    setErrorPersona('')

    const nombreLimpio = nuevoNombre.trim()
    if (!nombreLimpio) {
      setErrorPersona('El nombre es requerido')
      return
    }
    if (personas.some((p) => p.nombre.toLowerCase() === nombreLimpio.toLowerCase())) {
      setErrorPersona('Ese cliente ya existe en tu cartera — selecciona del listado')
      return
    }

    const nueva: PersonaItem = {
      id: `p${personas.length + 1}`,
      nombre: nombreLimpio,
      categoria: nuevaCategoria,
      documento: nuevoDocumento.trim() || 'Sin documento',
      telefono: nuevoTelefono.trim() || '—',
      direccion: nuevaDireccion.trim() || '—',
      visitasPendientes: 1,
    }
    try {
      const guardada = (await onSavePersona?.(nueva)) ?? nueva
      setPersonas((prev) => [...prev, guardada])
      setPersonaId(guardada.nombre)
      setMostrarAlta(false)
      setNuevoNombre('')
      setNuevoDocumento('')
      setNuevoTelefono('')
      setNuevaDireccion('')
      if (guardada.direccion !== '—' && !location.trim()) {
        setLocation(guardada.direccion)
      }
    } catch (err) {
      setErrorPersona(errorAltaPersona(err))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (actividadId === '') {
      setError('Selecciona el tipo de actividad')
      return
    }
    if (!personaSeleccionada) {
      setError('Selecciona el cliente de tu cartera o registra uno nuevo')
      return
    }
    if (subActividadId === '') {
      setError('Selecciona la sub actividad')
      return
    }
    if (!title.trim()) {
      setError('Escribe el título de la visita')
      return
    }

    const newEv: CalendarEvent = {
      id: `vis-${Date.now()}`,
      title: title.trim(),
      date,
      startTime,
      endTime,
      category: ACTIVIDAD_CATEGORIA[Number(actividadId)] ?? CATEGORIAS[Number(actividadId) % CATEGORIAS.length],
      location: location.trim() || undefined,
      videoCall: videoCall.trim() || undefined,
      notes: notes.trim() || undefined,
      reminder,
      personaId: personaSeleccionada?.id,
      personaName: personaSeleccionada?.nombre,
      actividadId: Number(actividadId),
      subActividadId: Number(subActividadId),
      actividadHoraId: horaId,
      estado: 'programada',
      attendees: INITIAL_ATTENDEES.slice(0, 2),
    }
    setGuardando(true)
    setError('')
    try {
      await onSave(newEv)
      onClose()
    } catch (err) {
      const msg = mensajeGc(err)
      setError(msg === 'No se pudo guardar' ? 'No se pudo guardar la visita' : msg)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog title="Nueva Visita / Gestión" onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
        <Select
          id="visita-actividad"
          label="Tipo de Actividad *"
          value={actividadId}
          onChange={(e) => handleActividadChange(e.target.value)}
        >
          <option value="">— Selecciona el tipo de actividad —</option>
          {catalogo.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Select>

        <Select
          id="visita-subactividad"
          label="Sub Actividad *"
          value={subActividadId}
          onChange={(e) => setSubActividadId(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={!actividadSeleccionada}
        >
          <option value="">
            {actividadSeleccionada ? '— Selecciona la sub actividad —' : 'Primero elige el tipo de actividad'}
          </option>
          {actividadSeleccionada?.sub_actividades.map((sa) => (
            <option key={sa.id} value={sa.id}>
              {sa.nombre}
            </option>
          ))}
        </Select>

        <Select
          id="visita-duracion"
          label="Duración estimada"
          value={horaId}
          onChange={(e) => setHoraId(Number(e.target.value))}
        >
          {catalogoHoras.map((h) => (
            <option key={h.id} value={h.id}>
              {h.nombre}
            </option>
          ))}
        </Select>

        <div className="relative">
          <Input
            id="visita-titulo"
            label="Título de la visita *"
            required
            placeholder={
              actividadSeleccionada && subActividadSeleccionada
                ? `${actividadSeleccionada.nombre} — ${subActividadSeleccionada.nombre}`
                : 'Ej. Verificación de garantías — Finca Las Palmas'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="pr-28"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1.5 bottom-1.5"
            onClick={() =>
              actividadSeleccionada &&
              subActividadSeleccionada &&
              setTitle(`${actividadSeleccionada.nombre} — ${subActividadSeleccionada.nombre}`)
            }
            disabled={!actividadSeleccionada || !subActividadSeleccionada}
          >
            Autocompletar
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Input id="visita-fecha" label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input
            id="visita-inicio"
            label="Inicio"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input id="visita-fin" label="Fin" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="visita-cliente" className="block text-sm font-medium text-ink">
              Cliente *
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMostrarAlta((v) => !v)}>
              {mostrarAlta ? 'Usar listado' : 'Nuevo cliente'}
            </Button>
          </div>

          {!mostrarAlta ? (
            <>
              <select
                id="visita-cliente"
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
                className={fieldClass}
              >
                <option value="">— Selecciona el cliente de tu cartera —</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.nombre}>
                    {p.nombre} · {p.documento}
                  </option>
                ))}
              </select>
              {personaSeleccionada && (
                <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
                  {personaSeleccionada.categoria}
                  {personaSeleccionada.saldo ? ` · Saldo ${personaSeleccionada.saldo}` : ''}
                  <br />
                  {personaSeleccionada.direccion}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2 rounded-xl border border-dashed border-primary/40 bg-canvas p-3">
              <Input
                id="alta-nombre"
                label="Nombre del cliente o negocio *"
                autoFocus
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="alta-documento"
                  label="NIT / DPI / Cédula"
                  value={nuevoDocumento}
                  onChange={(e) => setNuevoDocumento(e.target.value)}
                />
                <Input
                  id="alta-telefono"
                  label="Teléfono"
                  type="tel"
                  value={nuevoTelefono}
                  onChange={(e) => setNuevoTelefono(e.target.value)}
                />
              </div>
              <Input
                id="alta-direccion"
                label="Dirección del negocio"
                value={nuevaDireccion}
                onChange={(e) => setNuevaDireccion(e.target.value)}
              />
              <Select
                id="alta-categoria"
                label="Categoría"
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
              >
                <option>Prospecto — En evaluación</option>
                <option>Cliente — Crédito activo</option>
                <option>Cliente — Crédito agrícola activo</option>
                <option>Cliente — Crédito de consumo activo</option>
                <option>Punto de venta / Distribuidor</option>
                <option>Referido</option>
              </Select>
              {errorPersona ? (
                <Alert tone="danger" role="alert">
                  {errorPersona}
                </Alert>
              ) : null}
              <Button type="button" className="w-full" onClick={() => void handleRegistrarPersona()}>
                Registrar y usar en esta visita
              </Button>
            </div>
          )}
        </div>

        <Input
          id="visita-ubicacion"
          label="Ubicación / Dirección"
          placeholder="Ej. Km 42 Carretera al Pacífico, Escuintla"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <Input
          id="visita-video"
          label="Enlace / Videollamada (Meet / Zoom)"
          placeholder="Ej. meet.google.com/gc-visita-123"
          value={videoCall}
          onChange={(e) => setVideoCall(e.target.value)}
        />

        <Textarea
          id="visita-notas"
          label="Notas / Instrucciones"
          rows={2}
          placeholder="Ej. Llevar cámara para el registro fotográfico de las garantías"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Select id="visita-recordatorio" label="Recordatorio" value={reminder} onChange={(e) => setReminder(e.target.value)}>
          <option value="10 mins before">10 mins before</option>
          <option value="20 mins before">20 mins before</option>
          <option value="30 mins before">30 mins before</option>
          <option value="1 hour before">1 hour before</option>
          <option value="1 day before">1 day before</option>
        </Select>

        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <div className="pt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar visita'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
