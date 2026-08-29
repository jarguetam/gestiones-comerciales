import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DominioProvider } from './DominioContext'
import { NewEventModal } from '../features/calendar/components/NewEventModal'
import { cargarDominio, type FuenteDominio } from '../lib/cargarDominio'
import { CATALOGO_ACTIVIDADES, CATALOGO_HORAS, INITIAL_EVENTS } from '../features/calendar/eventsData'
import { INITIAL_PERSONAS, type PersonaItem } from '../features/calendar/personasData'
import { INITIAL_LEADS, type LeadItem } from '../features/calendar/leadsData'
import type { CalendarEvent } from '../features/calendar/types'
import type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo } from '../lib/catalogos'
import { persistirPersona, persistirVisita } from '../lib/persistir'
import { DEMO_MODE } from '../lib/supabase'
import { BRANDING_DEMO, varsDeBranding, type BrandingTenant } from '../lib/branding'
import { guardarBrandingCache } from '../lib/brandingPreLogin'
import { KpiSkeleton, TableSkeleton } from '../components/ui'
import type { CSSProperties } from 'react'
import type { AsesorOpcion } from './DominioContext'

const GEO_VACIO: GeoDefaults = { zonaId: null, departamentoId: null, municipioId: null, horaDefaultId: null }

export function EmpresaApp() {
  const [fuente, setFuente] = useState<FuenteDominio>('demo')
  const [tenantNombre, setTenantNombre] = useState('AgroMoney S.A.')
  const [tenantCodigo, setTenantCodigo] = useState<string | undefined>('agromoney')
  const [branding, setBranding] = useState<BrandingTenant>(BRANDING_DEMO)
  const [configuracion, setConfiguracion] = useState<Record<string, unknown>>({})
  const [aviso, setAviso] = useState<string | undefined>()
  const [eventos, setEventos] = useState<CalendarEvent[]>(INITIAL_EVENTS)
  const [personas, setPersonas] = useState<PersonaItem[]>(INITIAL_PERSONAS)
  const [leads, setLeads] = useState<LeadItem[]>(INITIAL_LEADS)
  const [asesores, setAsesores] = useState<AsesorOpcion[]>([])
  const [modulos, setModulos] = useState<string[]>(['crm', 'creditos', 'solicitudes', 'depositos', 'kilometraje'])
  const [catalogos, setCatalogos] = useState<CatalogoActividad[]>(CATALOGO_ACTIVIDADES)
  const [horas, setHoras] = useState<CatalogoHora[]>(CATALOGO_HORAS)
  const [zonas, setZonas] = useState<ZonaCatalogo[]>([])
  const [geo, setGeo] = useState<GeoDefaults>(GEO_VACIO)
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
        setTenantCodigo(d.tenantCodigo)
        setBranding(d.branding)
        setConfiguracion(d.configuracion)
        setAviso(d.aviso)
        setPersonas(d.personas)
        setEventos(d.eventos)
        setLeads(d.leads)
        setAsesores(d.asesores)
        setModulos(d.modulos)
        setCatalogos(d.catalogos)
        setHoras(d.horas)
        setZonas(d.zonas)
        setGeo(d.geo)
        guardarBrandingCache(d.branding, {
          host: window.location.hostname,
          codigo: d.tenantCodigo,
        })
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

  async function handleSaveEvent(event: CalendarEvent) {
    const persistir = !DEMO_MODE && fuente === 'supabase'
    const guardado = persistir ? await persistirVisita(event, geo) : event
    setEventos((prev) => [guardado, ...prev])
  }

  async function handleSavePersona(persona: PersonaItem): Promise<PersonaItem> {
    const persistir = !DEMO_MODE && fuente === 'supabase'
    const guardada = persistir ? await persistirPersona(persona) : persona
    setPersonas((prev) => (prev.some((p) => p.id === guardada.id) ? prev : [...prev, guardada]))
    return guardada
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
      tenantCodigo,
      branding,
      configuracion,
      aviso,
      eventos,
      personas,
      leads,
      asesores,
      modulos,
      catalogos,
      horas,
      zonas,
      geo,
      setEventos,
      setPersonas,
      setLeads,
      setConfiguracion,
      abrirNuevaVisita,
      convertirLead: handleConvertLead,
      setBranding,
      setTenantNombre,
    }),
    [fuente, tenantNombre, tenantCodigo, branding, configuracion, aviso, eventos, personas, leads, asesores, modulos, catalogos, horas, zonas, geo],
  )

  if (cargando) {
    return (
      <div className="min-h-screen bg-canvas p-6">
        <KpiSkeleton />
        <div className="mt-4">
          <TableSkeleton />
        </div>
      </div>
    )
  }

  return (
    <DominioProvider value={value}>
      <div style={varsDeBranding(branding) as CSSProperties}>
        <AppShell
          tenantNombre={tenantNombre}
          branding={branding}
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
            catalogos={catalogos}
            horas={horas}
            initialDate={new Date().toISOString().slice(0, 10)}
            initialPersonaName={personaInicial}
            onSavePersona={handleSavePersona}
            onClose={() => {
              setModalAbierto(false)
              setPersonaInicial('')
            }}
            onSave={handleSaveEvent}
          />
        )}
      </div>
    </DominioProvider>
  )
}
