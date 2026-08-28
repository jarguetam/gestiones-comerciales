/** M-08 — inbox in-app + deep-link a visita/solicitud. */

export interface ItemNotificacion {
  id: string
  titulo: string
  cuerpo: string
  leida: boolean
  creado_en: string
  datos?: Record<string, unknown>
}

export function contarNoLeidas(items: ItemNotificacion[]): number {
  return items.filter((n) => !n.leida).length
}

export function marcarLeida(items: ItemNotificacion[], id: string): ItemNotificacion[] {
  return items.map((n) => (n.id === id ? { ...n, leida: true } : n))
}

export function deepLinkDe(datos: Record<string, unknown> | null | undefined): string | null {
  if (!datos) return null
  if (datos.visita_id != null) return `gestiones://visita/${datos.visita_id}`
  if (datos.solicitud_id != null) return `gestiones://solicitud/${datos.solicitud_id}`
  return null
}

export function demoNotificaciones(): ItemNotificacion[] {
  return [
    {
      id: '1',
      titulo: 'Recordatorio de visita',
      cuerpo: 'En 20 minutos: Verificación de garantías — Agropecuaria El Triunfo (08:30).',
      leida: false,
      creado_en: '2026-08-28T12:10:00.000Z',
      datos: { visita_id: 104 },
    },
    {
      id: '2',
      titulo: 'Check-in requerido',
      cuerpo: 'Registra GPS al llegar a Km 56 Carretera a Puerto San José, Escuintla.',
      leida: false,
      creado_en: '2026-08-28T11:00:00.000Z',
      datos: { visita_id: 88 },
    },
    {
      id: '3',
      titulo: 'Solicitud lista para firmar',
      cuerpo: 'Crédito avío de Agrícola El Roble espera tu firma.',
      leida: true,
      creado_en: '2026-08-27T18:40:00.000Z',
      datos: { solicitud_id: 7 },
    },
    {
      id: '4',
      titulo: 'Visita rechazada',
      cuerpo: 'El supervisor rechazó tu visita a Comercial El Progreso: adjunta acta del acuerdo.',
      leida: true,
      creado_en: '2026-08-27T16:05:00.000Z',
      datos: { visita_id: 91 },
    },
  ]
}
