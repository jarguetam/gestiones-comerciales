/** W-13 — centro de notificaciones in-app. */

export interface ItemNotificacion {
  id: string
  titulo: string
  cuerpo: string
  leida: boolean
  creado_en: string
}

export function contarNoLeidas(items: ItemNotificacion[]): number {
  return items.filter((n) => !n.leida).length
}

export function marcarLeida(items: ItemNotificacion[], id: string): ItemNotificacion[] {
  return items.map((n) => (n.id === id ? { ...n, leida: true } : n))
}

export function demoNotificaciones(): ItemNotificacion[] {
  return [
    {
      id: '1',
      titulo: 'Recordatorio de visita',
      cuerpo: 'En 20 minutos: Verificación de garantías — Agropecuaria El Triunfo (08:30).',
      leida: false,
      creado_en: '2026-08-28T12:10:00.000Z',
    },
    {
      id: '2',
      titulo: 'Check-in requerido',
      cuerpo: 'Registra GPS al llegar a Km 56 Carretera a Puerto San José, Escuintla.',
      leida: false,
      creado_en: '2026-08-28T11:00:00.000Z',
    },
    {
      id: '3',
      titulo: 'Nueva asignación de persona',
      cuerpo: 'Tu supervisor Erick Bardales te asignó la cuenta Transportes El Norte.',
      leida: true,
      creado_en: '2026-08-27T18:40:00.000Z',
    },
    {
      id: '4',
      titulo: 'Visita rechazada',
      cuerpo: 'El supervisor rechazó tu visita a Comercial El Progreso: adjunta acta del acuerdo.',
      leida: true,
      creado_en: '2026-08-27T16:05:00.000Z',
    },
  ]
}

let inboxDemo: ItemNotificacion[] = demoNotificaciones()

export function estadoDemoNotificaciones(): ItemNotificacion[] {
  return inboxDemo.map((n) => ({ ...n }))
}

export function persistirLeidaDemo(id: string): void {
  inboxDemo = marcarLeida(inboxDemo, id)
}
