import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DominioProvider } from './DominioContext'
import { NewEventModal } from '../features/calendar/components/NewEventModal'
import { cargarDominio, type FuenteDominio } from '../lib/cargarDominio'
import { INITIAL_EVENTS } from '../features/calendar/eventsData'
import { INITIAL_PERSONAS, type PersonaItem } from '../features/calendar/personasData'
import { INITIAL_LEADS, type LeadItem } from '../features/calendar/leadsData'
import type { CalendarEvent } from '../features/calendar/types'

export function EmpresaApp() {
  const [fuente, setFuente] = useState<FuenteDominio>('demo')
  const [tenantNombre, setTenantNombre] = useState('AgroMoney S.A.')
  const [aviso, setAviso] = useState<string | undefined>()
  const [eventos, setEventos] = useState<CalendarEvent[]>(INITIAL_EVENTS)
  const [personas, setPersonas] = useState<PersonaItem[]>(INITIAL_PERSONAS)
  const [leads, setLeads] = useState<LeadItem[]>(INITIAL_LEADS)
  const [modulos, setModulos] = useState<string[]>(['crm', 'creditos', 'solicitudes', 'depositos', 'kilometraje'])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [personaInicial, setPersonaInicial] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    void cargarDominio()
      .then((d) => {
        if (!vivo) return
        setFuente(d.fuente)
        setTenantNombre(d.tenantNombre)
        setAviso(d.aviso)
        setPersonas(d.personas)
        setEventos(d.eventos)
        setLeads(d.leads)
        setModulos(d.modulos)
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  function abrirNuevaVisita(personaNombre?: string) {
    setPersonaInicial(personaNombre ?? '')
    setModalAbierto(true)
  }

  function handleSaveEvent(event: CalendarEvent) {
    setEventos((prev) => [event, ...prev])
  }

  function handleSavePersona(persona: PersonaItem) {
    setPersonas((prev) => (prev.some((p) => p.id === persona.id) ? prev : [...prev, persona]))
  }

  function handleConvertLead(lead: LeadItem) {
    setPersonas((prev) => {
      if (prev.some((p) => p.nombre === lead.nombre)) return prev
      return [
        ...prev,
        {
          id: `p${prev.length + 1}`,
          nombre: lead.nombre,
          categoria: 'Cliente — convertido desde CRM',
          documento: lead.documento ?? '',
          telefono: lead.telefono,
          direccion: lead.direccion ?? '',
          visitasPendientes: 0,
        },
      ]
    })
  }

  const value = useMemo(
    () => ({
      fuente,
      tenantNombre,
      aviso,
      eventos,
      personas,
      leads,
      modulos,
      setEventos,
      setPersonas,
      setLeads,
      abrirNuevaVisita,
      convertirLead: handleConvertLead,
    }),
    [fuente, tenantNombre, aviso, eventos, personas, leads, modulos]
  )

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3EEE4] text-slate-700">
        Cargando operación…
      </div>
    )
  }

  return (
    <DominioProvider value={value}>
      <AppShell
        tenantNombre={tenantNombre}
        fuente={fuente}
        aviso={aviso}
        modulos={modulos}
        onNuevaVisita={() => abrirNuevaVisita()}
      >
        <Outlet />
      </AppShell>
      {modalAbierto && (
        <NewEventModal
          cartera={personas}
          initialPersonaName={personaInicial}
          onSavePersona={handleSavePersona}
          onClose={() => {
            setModalAbierto(false)
            setPersonaInicial('')
          }}
          onSave={handleSaveEvent}
        />
      )}
    </DominioProvider>
  )
}
