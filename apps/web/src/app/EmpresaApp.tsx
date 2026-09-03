import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppShell } from './AppShell'
import { DominioProvider } from './DominioContext'
import { NewEventModal } from '../features/calendar/components/NewEventModal'
import { cargarDominio, type FuenteDominio } from '../lib/cargarDominio'
import type { PersonaItem } from '../features/calendar/personasData'
import type { LeadItem } from '../features/calendar/leadsData'
import type { CalendarEvent } from '../features/calendar/types'
import type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo } from '../lib/catalogos'
import { persistirPersona, persistirVisita } from '../lib/persistir'
import { varsDeBranding, type BrandingTenant } from '../lib/branding'
import { guardarBrandingCache } from '../lib/brandingPreLogin'
import { Alert, Button, KpiSkeleton, TableSkeleton } from '../components/ui'
import { mensajeToast } from '../lib/erroresUi'
import { canMutate } from '../lib/online'
import type { CSSProperties } from 'react'
import type { AsesorOpcion } from './DominioContext'

const GEO_VACIO: GeoDefaults = { zonaId: null, departamentoId: null, municipioId: null, horaDefaultId: null }

export function EmpresaApp() {
  const [fuente, setFuente] = useState<FuenteDominio>('supabase')
  const [tenantNombre, setTenantNombre] = useState('')
  const [tenantCodigo, setTenantCodigo] = useState<string | undefined>()
  const [branding, setBranding] = useState<BrandingTenant>({})
  const [configuracion, setConfiguracion] = useState<Record<string, unknown>>({})
  const [aviso, setAviso] = useState<string | undefined>()
  const [eventos, setEventos] = useState<CalendarEvent[]>([])
  const [personas, setPersonas] = useState<PersonaItem[]>([])
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [asesores, setAsesores] = useState<AsesorOpcion[]>([])
  const [modulos, setModulos] = useState<string[]>([])
  const [catalogos, setCatalogos] = useState<CatalogoActividad[]>([])
  const [horas, setHoras] = useState<CatalogoHora[]>([])
  const [zonas, setZonas] = useState<ZonaCatalogo[]>([])
  const [geo, setGeo] = useState<GeoDefaults>(GEO_VACIO)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [personaInicial, setPersonaInicial] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setErrorCarga(null)
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
      .catch((e) => {
        if (!vivo) return
        setErrorCarga(e instanceof Error ? e.message : 'GC-CORE-001')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [intento])

  function abrirNuevaVisita(personaNombre?: string) {
    if (!canMutate(typeof navigator === 'undefined' || navigator.onLine)) return
    setPersonaInicial(personaNombre ?? '')
    setModalAbierto(true)
  }

  async function handleSaveEvent(event: CalendarEvent) {
    const persistir = fuente === 'supabase'
    const guardado = persistir ? await persistirVisita(event, geo) : event
    setEventos((prev) => [guardado, ...prev])
  }

  async function handleSavePersona(persona: PersonaItem): Promise<PersonaItem> {
    const persistir = fuente === 'supabase'
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

  if (errorCarga) {
    const toast = mensajeToast(errorCarga)
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-line bg-surface p-6">
          <Alert tone="danger" role="alert">
            {toast.titulo}
            {toast.descripcion ? ` ${toast.descripcion}` : ''}
          </Alert>
          <Button onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
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
