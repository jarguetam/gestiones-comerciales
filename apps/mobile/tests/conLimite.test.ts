import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { intentarConLimite } from '../src/lib/conLimite.ts'

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('intentarConLimite: la tarea termina antes del límite y no avisa', async () => {
  const avisos: unknown[] = []
  let hecha = false
  await intentarConLimite(async () => { hecha = true }, 1_000, 'GC-X-001: y', (m, d) => avisos.push([m, d]))
  assert.equal(hecha, true)
  assert.deepEqual(avisos, [])
})

test('intentarConLimite: la tarea que nunca termina avisa al vencer el límite y sigue', async () => {
  const avisos: string[] = []
  const inicio = Date.now()
  await intentarConLimite(() => new Promise<void>(() => undefined), 20, 'GC-X-001: y', (m) => avisos.push(m))
  assert.ok(Date.now() - inicio < 1_000)
  assert.deepEqual(avisos, ['GC-X-001: y'])
})

test('intentarConLimite: la tarea que falla avisa con su error y no rechaza', async () => {
  const detalles: unknown[] = []
  const boom = new Error('boom')
  await intentarConLimite(async () => { throw boom }, 1_000, 'GC-X-001: y', (_m, d) => detalles.push(d))
  assert.deepEqual(detalles, [boom])
})

test('intentarConLimite: un fallo después del límite también se avisa', async () => {
  const detalles: unknown[] = []
  const tarde = new Error('tarde')
  await intentarConLimite(async () => { await espera(40); throw tarde }, 10, 'GC-X-001: y', (_m, d) => detalles.push(d))
  assert.equal(detalles.length, 1)
  await espera(60)
  assert.equal(detalles.length, 2)
  assert.equal(detalles[1], tarde)
})
