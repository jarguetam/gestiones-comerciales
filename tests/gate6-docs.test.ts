import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('README no afirma demo ni 24 migraciones', () => {
  const r = readFileSync('README.md', 'utf8')
  assert.equal(r.includes('24 migraciones'), false)
  assert.equal(/pdf-solicitud[\s\S]{0,40}404/.test(r), false)
  assert.equal(r.includes('Entrar al tablero'), false)
  assert.equal(r.includes('DEMO_MODE'), false)
  assert.match(r, /22\.14\.0|Node 22/)
  assert.match(r, /Gate 6/)
})

test('runbooks de Gate 6 existen', () => {
  assert.match(readFileSync('docs/runbooks/golive.md', 'utf8'), /golive-preflight/)
  assert.match(readFileSync('docs/runbooks/golive.md', 'utf8'), /pages-smoke/)
  const rb = readFileSync('docs/runbooks/rollback.md', 'utf8')
  assert.match(rb, /down-migration/i)
  assert.match(rb, /auth\.users|sesiones/i)
  assert.match(readFileSync('docs/runbooks/backup-restore.md', 'utf8'), /Ensayo Gate 6/)
  const ready = readFileSync('docs/runbooks/production-readiness.md', 'utf8')
  assert.match(ready, /GO\/NO-GO|GO \/ NO-GO/)
})
