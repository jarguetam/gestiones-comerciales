/** W-12 — log de auditoría del tenant. */

export interface ItemAuditoria {
  id: string
  tabla: string
  registro_id: string
  accion: string
  usuario_id: string | null
  usuario_nombre?: string | null
  cambios: Record<string, unknown>
  creado_en: string
}

export function textoDiff(cambios: Record<string, unknown> | null | undefined): string {
  if (!cambios || Object.keys(cambios).length === 0) return 'sin cambios'
  return Object.entries(cambios)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(' · ')
}

export function filtrarAuditoria(rows: ItemAuditoria[], q: string): ItemAuditoria[] {
  const t = q.trim().toLowerCase()
  if (!t) return rows
  return rows.filter((r) =>
    `${r.tabla} ${r.accion} ${r.registro_id} ${r.usuario_nombre ?? ''}`.toLowerCase().includes(t),
  )
}

export function demoAuditoria(): ItemAuditoria[] {
  return [
    {
      id: '1',
      tabla: 'visita',
      registro_id: '104',
      accion: 'update',
      usuario_id: 'u-luisa',
      usuario_nombre: 'Luisa Asesora',
      cambios: { estado: 'completada', anterior: 'programada' },
      creado_en: '2026-08-28T14:12:00.000Z',
    },
    {
      id: '2',
      tabla: 'persona',
      registro_id: '88',
      accion: 'insert',
      usuario_id: 'u-erick',
      usuario_nombre: 'Erick Supervisor',
      cambios: { nombre: 'Finca El Roble', documento: 'NIT-1044' },
      creado_en: '2026-08-28T13:40:00.000Z',
    },
    {
      id: '3',
      tabla: 'usuario',
      registro_id: 'u-ana',
      accion: 'update',
      usuario_id: 'u-admin',
      usuario_nombre: 'Ana Admin',
      cambios: { rol: 'asesor', jefe_id: 'u-erick' },
      creado_en: '2026-08-27T18:02:00.000Z',
    },
    {
      id: '4',
      tabla: 'lead',
      registro_id: '22',
      accion: 'update',
      usuario_id: 'u-luisa',
      usuario_nombre: 'Luisa Asesora',
      cambios: { estado: 'ganado' },
      creado_en: '2026-08-27T11:15:00.000Z',
    },
  ]
}
