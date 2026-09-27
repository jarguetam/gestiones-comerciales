import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { collectLocalEvidence, evaluateCiEvidence, evaluateHealthEvidence, runGolivePreflight, sentryConfigPresent } from './golive-preflight.ts'

const green = {
  gate0InventoryPath: 'docs/ops/inventory-latest.json',
  ciConclusion: 'success' as const,
  pgtapConclusion: 'success' as const,
  productionHealth: 'success' as const,
  sentryConfigured: true,
  demoStringInWebSrc: false,
  apkTrackedInGit: false,
}

test('ready es false si cualquier check falla', async () => {
  const red = await runGolivePreflight({ ...green, ciConclusion: 'failure' })
  assert.equal(red.ready, false)
  assert.equal(red.checks.find((c) => c.id === 'ci')?.ok, false)
})

test('ready es true solo si todos los checks ok', async () => {
  const ok = await runGolivePreflight(green)
  assert.equal(ok.ready, true)
  assert.deepEqual(
    ok.checks.map((c) => c.id),
    ['ci', 'pgtap', 'production-health', 'sentry-config', 'no-demo', 'no-apk-git'],
  )
  assert.ok(ok.checks.every((c) => c.ok))
})

test('unknown en CI no es ready', async () => {
  const r = await runGolivePreflight({ ...green, ciConclusion: 'unknown' })
  assert.equal(r.ready, false)
})

test('CI exige un push exitoso de main para el SHA candidato y pgTAP exitoso', () => {
  const sha = 'a'.repeat(40)
  const other = 'b'.repeat(40)
  const success = { headSha: sha, headBranch: 'main', event: 'push', status: 'completed', conclusion: 'success', databaseId: 10 }
  assert.deepEqual(evaluateCiEvidence([{ ...success, headSha: other }], sha, []), {
    ci: 'unknown', pgtap: 'failure', runId: null,
  })
  assert.deepEqual(evaluateCiEvidence([{ ...success, event: 'pull_request' }], sha, []), {
    ci: 'unknown', pgtap: 'failure', runId: null,
  })
  assert.deepEqual(evaluateCiEvidence([success], sha, [{ name: 'pgTAP (blank + replay)', conclusion: 'failure' }]), {
    ci: 'success', pgtap: 'failure', runId: 10,
  })
  assert.deepEqual(evaluateCiEvidence([success], sha, [{ name: 'pgTAP (blank + replay)', conclusion: 'success' }]), {
    ci: 'success', pgtap: 'success', runId: 10,
  })
})

test('token Sentry aislado no demuestra que el release se pueda crear', () => {
  assert.equal(sentryConfigPresent({ SENTRY_AUTH_TOKEN: 'token' }), false)
  assert.equal(sentryConfigPresent({
    SENTRY_AUTH_TOKEN: 'token', SENTRY_ORG: 'org',
    SENTRY_PROJECT_WEB: 'web', SENTRY_PROJECT_BACKOFFICE: 'backoffice',
  }), true)
})

test('probes viejos no autorizan promoción', () => {
  const now = Date.parse('2026-09-27T16:00:00Z')
  assert.equal(evaluateHealthEvidence([{ conclusion: 'success', updatedAt: '2026-09-27T15:30:00Z' }], now), 'success')
  assert.equal(evaluateHealthEvidence([{ conclusion: 'success', updatedAt: '2026-09-27T12:00:00Z' }], now), 'failure')
  assert.equal(evaluateHealthEvidence([{ conclusion: 'failure', updatedAt: '2026-09-27T15:30:00Z' }], now), 'failure')
})

test('DEMO_MODE o APK en git bloquean', async () => {
  assert.equal((await runGolivePreflight({ ...green, demoStringInWebSrc: true })).ready, false)
  assert.equal((await runGolivePreflight({ ...green, apkTrackedInGit: true })).ready, false)
})

test('collectLocalEvidence detecta DEMO_MODE y apk', () => {
  const demo = collectLocalEvidence({
    webSrcFiles: [{ path: 'apps/web/src/x.ts', content: 'const DEMO_MODE = true' }],
    gitTracked: ['apps/web/src/x.ts'],
  })
  assert.equal(demo.demoStringInWebSrc, true)
  assert.equal(demo.apkTrackedInGit, false)

  const apk = collectLocalEvidence({
    webSrcFiles: [{ path: 'apps/web/src/x.ts', content: 'export const x = 1' }],
    gitTracked: ['releases/preview.apk'],
  })
  assert.equal(apk.demoStringInWebSrc, false)
  assert.equal(apk.apkTrackedInGit, true)
})

test('supabase-prod exige preflight, workflow_dispatch y production', () => {
  const y = readFileSync('.github/workflows/supabase-prod.yml', 'utf8')
  assert.match(y, /workflow_dispatch/)
  assert.doesNotMatch(y, /on:\s*\n\s*push:/)
  assert.match(y, /environment:\s*production/)
  assert.match(y, /golive-preflight/)
})
