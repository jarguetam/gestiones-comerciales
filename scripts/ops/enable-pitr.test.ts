import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPitr, parsePitrConfig } from './enable-pitr.ts'

test('assertPitr lanza GC-OPS-008 si está apagado', () => {
  assert.throws(
    () => assertPitr({ enabled: false, retentionDays: 7 }),
    /GC-OPS-008/,
  )
})

test('assertPitr lanza GC-OPS-008 si retención < 7', () => {
  assert.throws(
    () => assertPitr({ enabled: true, retentionDays: 6 }),
    /GC-OPS-008/,
  )
})

test('assertPitr acepta 7 días o más', () => {
  assert.doesNotThrow(() => assertPitr({ enabled: true, retentionDays: 7 }))
  assert.doesNotThrow(() => assertPitr({ enabled: true, retentionDays: 14 }))
})

test('parsePitrConfig lee flags de Management API', () => {
  assert.deepEqual(
    parsePitrConfig({ pitr_enabled: true, pitr_retention_days: 7 }),
    { enabled: true, retentionDays: 7 },
  )
})
