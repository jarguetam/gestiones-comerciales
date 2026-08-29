/** Tipos del dominio F1 (visita, persona, rastreo) compartidos por las pantallas. */

export interface Visita {
  id: number
  persona_nombre: string
  direccion: string | null
  fecha_visita: string // YYYY-MM-DD
  hora_inicio: string | null
  estado: 'programada' | 'completada' | 'aprobada' | 'rechazada' | 'anulada'
  actividad: string | null
  latitud?: number | null
  longitud?: number | null
}

export interface Persona {
  id: number
  nombre: string
  documento: string | null
  documento_tipo: string
  direccion: string | null
  categoria: string | null
}

export interface PuntoGps {
  latitud: number
  longitud: number
  precision_m: number | null
  velocidad_kmh: number | null
  registrado_en: string
}
