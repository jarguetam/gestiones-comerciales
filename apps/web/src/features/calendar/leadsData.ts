/**
 * Pipeline CRM (F2) — datos alineados al dominio real.
 * Estados del embudo (lead_estado) y leads de demostración reutilizados
 * por CrmPipelineView (kanban) y el reporte de embudo.
 * En producción la fuente es public.lead + lead_estado vía RLS.
 */

export interface LeadEstadoItem {
  codigo: string
  nombre: string
  esGanado?: boolean
  esPerdido?: boolean
}

/** Embudo por defecto (lead_estado, configurable por tenant). */
export const LEAD_ESTADOS: LeadEstadoItem[] = [
  { codigo: 'nuevo', nombre: 'Nuevo' },
  { codigo: 'contactado', nombre: 'Contactado' },
  { codigo: 'calificado', nombre: 'Calificado' },
  { codigo: 'ganado', nombre: 'Ganado', esGanado: true },
  { codigo: 'perdido', nombre: 'Perdido', esPerdido: true },
]

export interface LeadItem {
  id: string
  nombre: string
  telefono: string
  documento?: string
  direccion?: string
  origen: string
  montoEstimado?: number
  estadoCodigo: string
  perdidoMotivo?: string
  /** set al convertir (ganado) → persona del núcleo */
  convertido?: boolean
}

export const LEAD_ORIGENES = ['Referido', 'Campaña', 'Walk-in', 'WhatsApp', 'Llamada'] as const

export const INITIAL_LEADS: LeadItem[] = [
  {
    id: 'l1', nombre: 'Finca La Esperanza', telefono: '+502 5511-2233',
    documento: 'NIT 8899001-2', direccion: 'Aldea El Rosario, Suchitepéquez',
    origen: 'Referido', montoEstimado: 85000, estadoCodigo: 'nuevo',
  },
  {
    id: 'l2', nombre: 'Abarrotería Don Miguel', telefono: '+502 4422-8899',
    direccion: 'Zona 4, Mixco', origen: 'Walk-in', montoEstimado: 25000, estadoCodigo: 'nuevo',
  },
  {
    id: 'l3', nombre: 'Ganadería San Marcos', telefono: '+502 5965-3344',
    documento: 'NIT 7654321-0', direccion: 'San Marcos', origen: 'Campaña',
    montoEstimado: 150000, estadoCodigo: 'contactado',
  },
  {
    id: 'l4', nombre: 'Pulpería La Esquina', telefono: '+502 3377-5566',
    direccion: 'Villa Nueva', origen: 'WhatsApp', montoEstimado: 12000, estadoCodigo: 'contactado',
  },
  {
    id: 'l5', nombre: 'Cooperativa Café Altura', telefono: '+502 5900-1122',
    documento: 'NIT 5544332-1', direccion: 'Huehuetenango', origen: 'Referido',
    montoEstimado: 240000, estadoCodigo: 'calificado',
  },
  {
    id: 'l6', nombre: 'Distribuidora El Sol', telefono: '+502 4488-9900',
    documento: 'NIT 3311224-8', direccion: 'Zona 12, Guatemala', origen: 'Llamada',
    montoEstimado: 60000, estadoCodigo: 'ganado', convertido: true,
  },
  {
    id: 'l7', nombre: 'Tortillería Mary', telefono: '+502 3355-6677',
    direccion: 'Chimaltenango', origen: 'Walk-in', estadoCodigo: 'perdido',
    perdidoMotivo: 'No le interesó el monto ofrecido',
  },
  {
    id: 'l8', nombre: 'Ferretería El Clavo', telefono: '+502 5599-0011',
    direccion: 'Escuintla', origen: 'Campaña', montoEstimado: 40000, estadoCodigo: 'calificado',
  },
]

export function nextLeadId(leads: LeadItem[]): string {
  return `l${leads.length + 1}`
}
