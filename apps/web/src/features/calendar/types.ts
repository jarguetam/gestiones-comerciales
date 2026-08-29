export type EventCategory = 'amber' | 'mint' | 'sky' | 'lavender' | 'rose'

export interface Attendee {
  id: string
  name: string
  avatarUrl?: string
  initials: string
  role?: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  category: EventCategory
  location?: string
  videoCall?: string
  notes?: string
  attendees?: Attendee[]
  reminder?: string
  completed?: boolean
  personaId?: string
  personaName?: string
  /** Catálogo actividad → sub_actividad (tabla visita, F1.2) */
  actividadId?: number
  subActividadId?: number
  actividadHoraId?: number
  /** Máquina de estados de la visita: programada → completada → aprobada/rechazada; anulada */
  estado?: 'programada' | 'completada' | 'aprobada' | 'rechazada' | 'anulada'
  checkinGps?: {
    lat: number
    lng: number
    timestamp: string
  }
  asesorId?: string
  asesorNombre?: string
  zonaId?: number
  zonaNombre?: string
  latitud?: number | null
  longitud?: number | null
  completadaEn?: string | null
  revisadaEn?: string | null
  creadoEn?: string | null
}

