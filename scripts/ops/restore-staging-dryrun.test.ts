import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  evaluateRestoreFixture,
  readRestoreFixture,
  restoreTargetAllowed,
} from './restore-staging-dryrun.ts'

test('restore staging dry-run sale ok con fixture select 1', () => {
  const sql = readRestoreFixture('scripts/ops/fixtures/restore-dryrun.sql')
  const r = evaluateRestoreFixture(sql)
  assert.equal(r.ok, true)
  assert.match(r.detail, /select 1/i)
  assert.match(r.detail, /dry-run/)
})

test('restore real nunca apunta a prod', () => {
  assert.equal(restoreTargetAllowed('xcoeipsnykceorcvjwve'), false)
  assert.equal(restoreTargetAllowed('staging-ref'), true)
  assert.equal(restoreTargetAllowed(undefined), false)
})

test('script bash existe y bloquea prod', () => {
  const sh = readFileSync('scripts/ops/restore-staging-dryrun.sh', 'utf8')
  assert.match(sh, /select 1/i)
  assert.match(sh, /xcoeipsnykceorcvjwve/)
  assert.match(sh, /RESTORE_DRY_RUN/)
})
