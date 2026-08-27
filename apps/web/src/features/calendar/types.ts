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
}

export interface CategoryStyle {
  bg: string
  bar: string
  text: string
  border: string
  dot: string
  lightBg: string
}

export const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  amber: {
    bg: 'bg-[#FEF3C7]',
    bar: 'bg-[#F59E0B]',
    text: 'text-[#92400E]',
    border: 'border-[#F59E0B]',
    dot: 'bg-[#F59E0B]',
    lightBg: '#FEF3C7',
  },
  mint: {
    bg: 'bg-[#CCFBF1]',
    bar: 'bg-[#14B8A6]',
    text: 'text-[#115E59]',
    border: 'border-[#14B8A6]',
    dot: 'bg-[#14B8A6]',
    lightBg: '#CCFBF1',
  },
  sky: {
    bg: 'bg-[#E0F2FE]',
    bar: 'bg-[#38BDF8]',
    text: 'text-[#075985]',
    border: 'border-[#38BDF8]',
    dot: 'bg-[#38BDF8]',
    lightBg: '#E0F2FE',
  },
  lavender: {
    bg: 'bg-[#EDE9FE]',
    bar: 'bg-[#8B5CF6]',
    text: 'text-[#5B21B6]',
    border: 'border-[#8B5CF6]',
    dot: 'bg-[#8B5CF6]',
    lightBg: '#EDE9FE',
  },
  rose: {
    bg: 'bg-[#FFE4E6]',
    bar: 'bg-[#F43F5E]',
    text: 'text-[#9F1239]',
    border: 'border-[#F43F5E]',
    dot: 'bg-[#F43F5E]',
    lightBg: '#FFE4E6',
  },
}
