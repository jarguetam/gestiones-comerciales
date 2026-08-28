import type { PuntoMapa } from '../../lib/mapa'

export interface ClienteMapa {
  id: string
  nombre: string
  lat: number
  lng: number
}

export interface SupervisorOpcion {
  id: string
  nombre: string
}

function stamp(hora: string): string {
  const [hh, mm] = hora.split(':').map(Number)
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

export const SUPERVISORES_DEMO: SupervisorOpcion[] = [
  { id: 'u-erick', nombre: 'Erick Supervisor' },
  { id: 'u-sofia', nombre: 'Sofía Supervisora' },
]

export const CLIENTES_DEMO: ClienteMapa[] = [
  { id: 'p1', nombre: 'Agropecuaria El Triunfo', lat: 14.301, lng: -90.786 },
  { id: 'p2', nombre: 'Distribuidora La Bendición', lat: 14.844, lng: -91.518 },
  { id: 'p3', nombre: 'Farmacia Santa María', lat: 14.642, lng: -90.513 },
]

/** Recorridos demo del día (hora local) sobre Guatemala. */
export function puntosDemo(): PuntoMapa[] {
  return [
    {
      usuarioId: 'u-luisa',
      nombre: 'Luisa Asesora',
      rol: 'asesor',
      jefeId: 'u-erick',
      lat: 14.305,
      lng: -90.785,
      registradoEn: stamp('08:15'),
      precisionM: 18,
    },
    {
      usuarioId: 'u-luisa',
      nombre: 'Luisa Asesora',
      rol: 'asesor',
      jefeId: 'u-erick',
      lat: 14.318,
      lng: -90.772,
      registradoEn: stamp('10:40'),
      precisionM: 22,
    },
    {
      usuarioId: 'u-luisa',
      nombre: 'Luisa Asesora',
      rol: 'asesor',
      jefeId: 'u-erick',
      lat: 14.334,
      lng: -90.758,
      registradoEn: stamp('13:20'),
      precisionM: 15,
    },
    {
      usuarioId: 'u-carlos',
      nombre: 'Carlos Asesor',
      rol: 'asesor',
      jefeId: 'u-erick',
      lat: 14.634,
      lng: -90.513,
      registradoEn: stamp('09:00'),
      precisionM: 12,
    },
    {
      usuarioId: 'u-carlos',
      nombre: 'Carlos Asesor',
      rol: 'asesor',
      jefeId: 'u-erick',
      lat: 14.618,
      lng: -90.535,
      registradoEn: stamp('11:30'),
      precisionM: 20,
    },
    {
      usuarioId: 'u-carlos',
      nombre: 'Carlos Asesor',
      rol: 'asesor',
      jefeId: 'u-erick',
      lat: 14.589,
      lng: -90.552,
      registradoEn: stamp('15:10'),
      precisionM: 16,
    },
    {
      usuarioId: 'u-ana',
      nombre: 'Ana Asesora',
      rol: 'asesor',
      jefeId: 'u-sofia',
      lat: 14.844,
      lng: -91.518,
      registradoEn: stamp('08:45'),
      precisionM: 25,
    },
    {
      usuarioId: 'u-ana',
      nombre: 'Ana Asesora',
      rol: 'asesor',
      jefeId: 'u-sofia',
      lat: 14.861,
      lng: -91.501,
      registradoEn: stamp('12:05'),
      precisionM: 19,
    },
    {
      usuarioId: 'u-erick',
      nombre: 'Erick Supervisor',
      rol: 'supervisor',
      jefeId: 'u-mario',
      lat: 14.601,
      lng: -90.521,
      registradoEn: stamp('07:50'),
      precisionM: 14,
    },
  ]
}
