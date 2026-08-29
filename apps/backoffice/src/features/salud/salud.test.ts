import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  estadoJob,
  formatearBytes,
  resumenSalud,
  demoSalud,
  etiquetaEstado,
  type JobSalud,
} from './salud.ts'

function job(parcial: Partial<JobSalud> = {}): JobSalud {
  return {
    nombre: 'snapshot-cuentas',
    schedule: '30 0 * * *',
    activo: true,
    programado: true,
    ultima_corrida: '2026-08-28T00:30:00.000Z',
    ultimo_estado: 'succeeded',
    ...parcial,
  }
}

describe('estadoJob', () => {
  const ahora = new Date('2026-08-28T12:00:00.000Z')

  it('marca no_programado si el cron esperado no está en pg_cron', () => {
    assert.equal(estadoJob(job({ programado: false }), ahora), 'no_programado')
  })

  it('marca fallo si la última corrida falló aunque sea reciente', () => {
    assert.equal(
      estadoJob(job({ ultimo_estado: 'failed', ultima_corrida: '2026-08-28T11:00:00.000Z' }), ahora),
      'fallo',
    )
  })

  it('marca atrasado si nunca corrió estando activo', () => {
    assert.equal(estadoJob(job({ ultima_corrida: null, ultimo_estado: null }), ahora), 'atrasado')
  })

  it('marca atrasado si la última corrida supera 26 h', () => {
    assert.equal(
      estadoJob(job({ ultima_corrida: '2026-08-27T09:00:00.000Z', ultimo_estado: 'succeeded' }), ahora),
      'atrasado',
    )
  })

  it('marca ok si la última corrida succeeded dentro de la ventana', () => {
    assert.equal(
      estadoJob(job({ ultima_corrida: '2026-08-28T00:30:00.000Z', ultimo_estado: 'succeeded' }), ahora),
      'ok',
    )
  })

  it('un job inactivo no se considera atrasado', () => {
    assert.equal(
      estadoJob(job({ activo: false, ultima_corrida: null, ultimo_estado: null }), ahora),
      'ok',
    )
  })
})

describe('resumenSalud', () => {
  it('suma uso y cuenta jobs con problema', () => {
    const r = resumenSalud({
      generado_en: '2026-08-28T12:00:00.000Z',
      jobs: [
        job({ nombre: 'snapshot-cuentas', ultima_corrida: '2026-08-28T00:30:00.000Z' }),
        job({ nombre: 'recordatorio-depositos', programado: false }),
        job({ nombre: 'notify-jobs-recordatorio-agenda', ultimo_estado: 'failed' }),
      ],
      tenants: [
        {
          id: 't1',
          codigo: 'GT1',
          nombre: 'Agro',
          activo: true,
          dispositivos_activos: 4,
          notificaciones_24h: 10,
          storage_bytes: 2048,
          errores_edge_24h: 1,
          errores_integracion_24h: 2,
        },
        {
          id: 't2',
          codigo: 'GT2',
          nombre: 'Distri',
          activo: false,
          dispositivos_activos: 1,
          notificaciones_24h: 0,
          storage_bytes: 0,
          errores_edge_24h: 0,
          errores_integracion_24h: 0,
        },
      ],
    }, new Date('2026-08-28T12:00:00.000Z'))
    assert.equal(r.tenants, 2)
    assert.equal(r.tenantsActivos, 1)
    assert.equal(r.dispositivos, 5)
    assert.equal(r.notificaciones24h, 10)
    assert.equal(r.storageBytes, 2048)
    assert.equal(r.errores24h, 3)
    assert.equal(r.jobsProblema, 2)
  })
})

describe('formatearBytes', () => {
  it('formatea B / KB / MB', () => {
    assert.equal(formatearBytes(0), '0 B')
    assert.equal(formatearBytes(512), '512 B')
    assert.equal(formatearBytes(2048), '2 KB')
    assert.equal(formatearBytes(3 * 1024 * 1024), '3 MB')
  })
})

describe('demoSalud', () => {
  it('incluye jobs, tenants y las tres señales de P-06', () => {
    const demo = demoSalud()
    assert.ok(demo.jobs.length >= 4)
    assert.ok(demo.tenants.length >= 2)
    const r = resumenSalud(demo)
    assert.ok(r.dispositivos > 0)
    assert.ok(r.errores24h >= 0)
    assert.equal(etiquetaEstado('fallo'), 'Falló')
    assert.equal(etiquetaEstado('atrasado'), 'Atrasado')
    assert.equal(etiquetaEstado('no_programado'), 'No programado')
    assert.equal(etiquetaEstado('ok'), 'OK')
  })
})
