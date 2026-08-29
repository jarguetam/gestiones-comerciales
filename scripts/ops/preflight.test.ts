import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { finalizePreflight, listLocalMigrations, listLocalFunctions, main } from './preflight.ts'
import { preflightMessage } from './preflight-types.ts'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const INVENTORY_PATH = path.join(ROOT, 'docs/ops/inventory-latest.json')

const EDGE_FUNCTIONS = [
  'auth-guard', 'importer', 'invitar-usuario', 'notify-jobs',
  'pdf-solicitud', 'push-notifications', 'rastreo-ingesta', 'webhook-tenant',
]

const minimalReport = {
  message: '',
  local: { migrations: [], functions: [] },
  missing: [] as string[],
  extraRemote: [] as string[],
  canCreateProject: false,
}

test('listLocalMigrations tiene al menos 26 sql únicos con sufijo .sql', async () => {
  const migs = await listLocalMigrations()
  assert.ok(migs.length >= 26, `expected >= 26 migrations, got ${migs.length}`)
  assert.equal(new Set(migs).size, migs.length)
  for (const name of migs) assert.ok(name.endsWith('.sql'), name)
})

test('listLocalFunctions incluye las 8 edge', async () => {
  const fns = await listLocalFunctions()
  for (const f of EDGE_FUNCTIONS) assert.ok(fns.includes(f), f)
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

test('main local-only escribe inventario y retorna ok sin token', async () => {
  const env = { ...process.env, PREFLIGHT_LOCAL_ONLY: '1' }
  delete env.SUPABASE_ACCESS_TOKEN
  const report = await main(env)
  assert.equal(report.ok, true)
  assert.match(report.message, /local-only/)
  assert.ok(report.local.migrations.length >= 26)
  for (const f of EDGE_FUNCTIONS) assert.ok(report.local.functions.includes(f), f)
  assert.equal(report.remote, undefined)
  const raw = await readFile(INVENTORY_PATH, 'utf8')
  const saved = JSON.parse(raw) as typeof report
  assert.equal(saved.ok, true)
  assert.deepEqual(saved.local.migrations, report.local.migrations)
})

test('main sin token falla con GC-OPS-001', async () => {
  const env = { ...process.env }
  delete env.PREFLIGHT_LOCAL_ONLY
  delete env.SUPABASE_ACCESS_TOKEN
  await assert.rejects(() => main(env), /GC-OPS-001/)
})
