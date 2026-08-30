import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

const ci = () => readFileSync('.github/workflows/ci.yml', 'utf8')
const prod = () => readFileSync('.github/workflows/supabase-prod.yml', 'utf8')

test('CI no usa --no-frozen-lockfile', () => {
  const y = ci()
  assert.equal(y.includes('--no-frozen-lockfile'), false)
})

test('CI usa Node 22.14.0', () => {
  const y = ci()
  assert.match(y, /node-version:\s*['"]?22\.14\.0['"]?/)
})

test('CI corre supabase test db', () => {
  const y = ci()
  assert.match(y, /supabase test db|pgtap\.sh/)
})

test('CI contiene gitleaks, deno fmt --check y security_definer', () => {
  const y = ci()
  assert.match(y, /gitleaks/)
  assert.match(y, /deno fmt --check/)
  assert.match(y, /security_definer/)
})

test('CI no usa pnpm --filter con audit', () => {
  const y = ci()
  assert.equal(/\bpnpm\s+--filter[^\n]*\baudit\b/.test(y), false)
  assert.match(y, /audit-runtime\.ts/)
})

test('fixture pgTAP crea schema tests, jerarquía válida y hace COMMIT', () => {
  const sql = readFileSync('supabase/tests/000_setup_tests.sql', 'utf8')
  assert.match(sql, /create schema if not exists tests/)
  assert.match(sql, /insert into auth\.users/)
  assert.ok(
    sql.indexOf('insert into auth.users') < sql.indexOf('insert into public.usuario'),
    'auth.users debe existir antes de public.usuario (usuario_id_fkey)',
  )
  assert.match(sql, /\bcommit\s*;/i)
  assert.match(sql, /'Gerente T1',\s*'gerente',\s*null/)
  assert.doesNotMatch(
    sql,
    /'Gerente T1',\s*'gerente',\s*'aaaaaaaa-0000-0000-0000-000000000001'/,
  )
  assert.match(
    sql,
    /'Asesor T2',\s*'asesor',\s*'bbbbbbbb-0000-0000-0000-000000000004'/,
  )
  assert.doesNotMatch(sql, /insert into public\.actividad \(tenant_id, codigo/)
  assert.match(sql, /grant usage on schema tests/)
})

test('CI instala pnpm antes de cache: pnpm en setup-node', () => {
  const jobs = ci().split(/^  [a-z][\w-]*:/m).slice(1)
  let seen = 0
  for (const job of jobs) {
    if (!job.includes('cache: pnpm')) continue
    seen += 1
    const pnpmAt = job.indexOf('pnpm/action-setup')
    const nodeAt = job.indexOf('actions/setup-node')
    assert.ok(pnpmAt !== -1, 'el job con cache: pnpm debe instalar pnpm')
    assert.ok(
      pnpmAt < nodeAt,
      'pnpm/action-setup debe ir antes de setup-node cuando se usa cache: pnpm',
    )
  }
  assert.ok(seen >= 1, 'se espera al menos un cache: pnpm en ci.yml')
})

test('CI inyecta VITE_RELEASE y VITE_SENTRY_DSN en el build', () => {
  const y = ci()
  assert.match(y, /VITE_RELEASE:\s*ci/)
  assert.match(y, /VITE_SENTRY_DSN:\s*https:\/\/public@o0\.ingest\.sentry\.io\/0/)
})

test('yaml prod no tiene on.push a main para db push', () => {
  const y = prod()
  assert.doesNotMatch(y, /on:\s*\n\s*push:/)
  assert.match(y, /workflow_dispatch/)
  assert.match(y, /environment:\s*production/)
})
