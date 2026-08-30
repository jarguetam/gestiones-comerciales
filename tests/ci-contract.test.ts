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

test('yaml prod no tiene on.push a main para db push', () => {
  const y = prod()
  assert.doesNotMatch(y, /on:\s*\n\s*push:/)
  assert.match(y, /workflow_dispatch/)
  assert.match(y, /environment:\s*production/)
})
