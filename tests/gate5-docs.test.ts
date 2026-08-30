import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'

test('README no dice 24 migraciones ni pdf-solicitud 404 ni promete emailer', () => {
  const readme = readFileSync('README.md', 'utf8')
  assert.doesNotMatch(readme, /24 migraciones/)
  assert.doesNotMatch(readme, /pdf-solicitud.*404/)
  assert.doesNotMatch(readme, /emailer \(Resend/)
  const n = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).length
  assert.match(readme, new RegExp(`${n} migraciones`))
  assert.match(readme, /8 Edge/)
})

test('SECURITY.md, CODEOWNERS y Dependabot existen', () => {
  assert.match(readFileSync('SECURITY.md', 'utf8'), /jarguetam/)
  assert.match(readFileSync('.github/CODEOWNERS', 'utf8'), /@jarguetam/)
  const dep = readFileSync('.github/dependabot.yml', 'utf8')
  assert.match(dep, /package-ecosystem:\s*npm/)
  assert.match(dep, /package-ecosystem:\s*github-actions/)
  assert.match(dep, /interval:\s*weekly/)
})

test('runbooks de Gate 5 existen', () => {
  for (const f of [
    'docs/runbooks/incidents.md',
    'docs/runbooks/secrets-rotation.md',
    'docs/runbooks/backup-restore.md',
    'docs/runbooks/smtp.md',
    'docs/runbooks/deploy.md',
    'docs/runbooks/rollback.md',
    'docs/runbooks/usuario-baja.md',
    'docs/runbooks/dispositivo-perdido.md',
    'docs/runbooks/fcm-falla.md',
    'docs/runbooks/cron.md',
    'docs/ops/panel.md',
    'docs/superpowers/plans/2026-08-29-gate-5-checklist.md',
  ]) {
    assert.match(readFileSync(f, 'utf8'), /\S/, f)
  }
})
