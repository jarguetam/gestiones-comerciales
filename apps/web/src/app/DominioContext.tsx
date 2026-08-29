import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { CalendarEvent } from '../features/calendar/types'
import type { PersonaItem } from '../features/calendar/personasData'
import type { LeadItem } from '../features/calendar/leadsData'
import type { FuenteDominio } from '../lib/cargarDominio'
import type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo } from '../lib/catalogos'
import type { BrandingTenant } from '../lib/branding'

export interface DominioState {
  fuente: FuenteDominio
  tenantNombre: string
  branding: BrandingTenant
  aviso?: string
  eventos: CalendarEvent[]
  personas: PersonaItem[]
  leads: LeadItem[]
  modulos: string[]
  catalogos: CatalogoActividad[]
  horas: CatalogoHora[]
  zonas: ZonaCatalogo[]
  geo: GeoDefaults
  setEventos: (eventos: CalendarEvent[]) => void
  setPersonas: (personas: PersonaItem[]) => void
  setLeads: (leads: LeadItem[]) => void
  abrirNuevaVisita: (personaNombre?: string) => void
  convertirLead: (lead: LeadItem) => void
  setBranding: (b: BrandingTenant) => void
  setTenantNombre: (n: string) => void
}

const DominioContext = createContext<DominioState | null>(null)

export function DominioProvider({
  value,
  children,
}: {
  value: DominioState
  children: ReactNode
}) {
  return <DominioContext.Provider value={value}>{children}</DominioContext.Provider>
}

export function useDominio() {
  const ctx = useContext(DominioContext)
  if (!ctx) throw new Error('useDominio debe usarse dentro de EmpresaApp')
  return ctx
}
