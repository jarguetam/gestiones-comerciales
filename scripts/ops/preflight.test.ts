import assert from 'node:assert/strict'
import test from 'node:test'
import { finalizePreflight, listLocalMigrations, listLocalFunctions } from './preflight.ts'
import { preflightMessage } from './preflight-types.ts'

const minimalReport = {
  message: '',
  local: { migrations: [], functions: [] },
  missing: [] as string[],
  extraRemote: [] as string[],
  canCreateProject: false,
}

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

test('finalizePreflight preserva ok:false y GC-OPS-002 sin drift', () => {
  const r = finalizePreflight({
    ...minimalReport,
    ok: false,
    code: 'GC-OPS-002',
    message: preflightMessage('GC-OPS-002'),
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'GC-OPS-002')
})

test('finalizePreflight falla con GC-OPS-007 si hay extraRemote', () => {
  const r = finalizePreflight({
    ...minimalReport,
    ok: false,
    code: 'GC-OPS-002',
    message: preflightMessage('GC-OPS-002'),
    extraRemote: ['20260826120000_remote_only.sql'],
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'GC-OPS-007')
  assert.match(r.message, /20260826120000_remote_only\.sql/)
})
