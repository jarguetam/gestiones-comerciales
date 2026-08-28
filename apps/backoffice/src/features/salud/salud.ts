/** Tipos y helpers de P-06 — salud de plataforma (jobs, errores Edge, uso). */

export type EstadoJob = 'ok' | 'fallo' | 'atrasado' | 'no_programado'

export interface JobSalud {
  nombre: string
  schedule: string
  activo: boolean
  programado: boolean
  ultima_corrida: string | null
  ultimo_estado: string | null
}

export interface TenantSalud {
  id: string
  codigo: string
  nombre: string
  activo: boolean
  dispositivos_activos: number
  notificaciones_24h: number
  storage_bytes: number
  errores_edge_24h: number
  errores_integracion_24h: number
}

export interface SaludPlataforma {
  generado_en: string
  jobs: JobSalud[]
  tenants: TenantSalud[]
}

export interface ResumenSalud {
  tenants: number
  tenantsActivos: number
  dispositivos: number
  notificaciones24h: number
  storageBytes: number
  errores24h: number
  jobsProblema: number
}

/** Ventana: un job diario se considera atrasado si no corrió en 26 h. */
export const VENTANA_ATRASO_MS = 26 * 60 * 60 * 1000

export function estadoJob(job: JobSalud, ahora: Date = new Date()): EstadoJob {
  if (!job.programado) return 'no_programado'
  if (esFallo(job.ultimo_estado)) return 'fallo'
  if (!job.activo) return 'ok'
  if (!job.ultima_corrida) return 'atrasado'
  const t = Date.parse(job.ultima_corrida)
  if (Number.isNaN(t) || ahora.getTime() - t > VENTANA_ATRASO_MS) return 'atrasado'
  return 'ok'
}

function esFallo(estado: string | null): boolean {
  if (!estado) return false
  return /fail|error|dead/i.test(estado)
}

export function etiquetaEstado(estado: EstadoJob): string {
  switch (estado) {
    case 'ok':
      return 'OK'
    case 'fallo':
      return 'Falló'
    case 'atrasado':
      return 'Atrasado'
    case 'no_programado':
      return 'No programado'
  }
}

export function resumenSalud(salud: SaludPlataforma, ahora: Date = new Date()): ResumenSalud {
  return {
    tenants: salud.tenants.length,
    tenantsActivos: salud.tenants.filter((t) => t.activo).length,
    dispositivos: salud.tenants.reduce((a, t) => a + t.dispositivos_activos, 0),
    notificaciones24h: salud.tenants.reduce((a, t) => a + t.notificaciones_24h, 0),
    storageBytes: salud.tenants.reduce((a, t) => a + t.storage_bytes, 0),
    errores24h: salud.tenants.reduce((a, t) => a + t.errores_edge_24h + t.errores_integracion_24h, 0),
    jobsProblema: salud.jobs.filter((j) => estadoJob(j, ahora) !== 'ok').length,
  }
}

export function formatearBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${Math.round(n / (1024 * 1024))} MB`
}

export function demoSalud(ahora: Date = new Date('2026-08-28T12:00:00.000Z')): SaludPlataforma {
  const iso = ahora.toISOString()
  return {
    generado_en: iso,
    jobs: [
      {
        nombre: 'notify-jobs-recordatorio-agenda',
        schedule: '30 12 * * *',
        activo: true,
        programado: true,
        ultima_corrida: '2026-08-28T12:30:00.000Z',
        ultimo_estado: 'succeeded',
      },
      {
        nombre: 'snapshot-cuentas',
        schedule: '30 0 * * *',
        activo: true,
        programado: true,
        ultima_corrida: '2026-08-28T00:30:00.000Z',
        ultimo_estado: 'succeeded',
      },
      {
        nombre: 'recordatorio-depositos',
        schedule: '30 14,21 * * 1-5',
        activo: true,
        programado: true,
        ultima_corrida: '2026-08-27T21:30:00.000Z',
        ultimo_estado: 'failed',
      },
      {
        nombre: 'recordatorio-kilometraje',
        schedule: '0 14,23 * * *',
        activo: true,
        programado: false,
        ultima_corrida: null,
        ultimo_estado: null,
      },
    ],
    tenants: [
      {
        id: 'demo',
        codigo: 'demo-agromoney',
        nombre: 'AgroMoney (demo)',
        activo: true,
        dispositivos_activos: 18,
        notificaciones_24h: 42,
        storage_bytes: 12 * 1024 * 1024,
        errores_edge_24h: 1,
        errores_integracion_24h: 2,
      },
      {
        id: 'demo2',
        codigo: 'demo-distri',
        nombre: 'Distribuidora GT (demo)',
        activo: true,
        dispositivos_activos: 7,
        notificaciones_24h: 9,
        storage_bytes: 3 * 1024 * 1024,
        errores_edge_24h: 0,
        errores_integracion_24h: 0,
      },
    ],
  }
}
