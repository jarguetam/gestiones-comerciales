import assert from 'node:assert/strict'
import test from 'node:test'
import { diffMigrations, preflightMessage, summarizePreflight } from './preflight-types.ts'

test('diffMigrations detecta locales no aplicadas', () => {
  const d = diffMigrations(
    ['20260826120000_f0_tenancy_plataforma.sql', '20260829100000_persona_visita_rls_claims.sql'],
    ['20260826120000_f0_tenancy_plataforma.sql'],
  )
  assert.deepEqual(d.missing, ['20260829100000_persona_visita_rls_claims.sql'])
  assert.deepEqual(d.extraRemote, [])
})

test('summarizePreflight preserva ok:false con GC-OPS-002 sin drift', () => {
  const r = summarizePreflight({
    ok: false,
    code: 'GC-OPS-002',
    message: preflightMessage('GC-OPS-002'),
    local: { migrations: [], functions: [] },
    missing: [],
    extraRemote: [],
    canCreateProject: false,
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'GC-OPS-002')
})

test('summarizePreflight falla con GC-OPS-007 si hay drift', () => {
  const r = summarizePreflight({
    ok: true,
    message: '',
    local: { migrations: ['a.sql'], functions: [] },
    remote: {
      projectRef: 'xcoeipsnykceorcvjwve',
      region: 'us-west-2',
      postgresMajor: 17,
      migrations: [],
      functions: [],
      buckets: [],
      cronJobs: [],
      authHookEnabled: true,
      siteUrl: null,
    },
    missing: ['a.sql'],
    extraRemote: [],
    canCreateProject: true,
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'GC-OPS-007')
})
