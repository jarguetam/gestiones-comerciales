import assert from 'node:assert/strict'
import test from 'node:test'
import { listLocalMigrations, listLocalFunctions } from './preflight.ts'

test('listLocalMigrations cuenta 26 sql', async () => {
  const migs = await listLocalMigrations()
  assert.equal(migs.length, 26)
  assert.ok(migs[0].endsWith('.sql'))
})

test('listLocalFunctions incluye las 8 edge', async () => {
  const fns = await listLocalFunctions()
  for (const f of [
    'auth-guard', 'importer', 'invitar-usuario', 'notify-jobs',
    'pdf-solicitud', 'push-notifications', 'rastreo-ingesta', 'webhook-tenant',
  ]) assert.ok(fns.includes(f), f)
})
