import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  collectLocalEvidence, evaluateCiEvidence, evaluateCron, evaluateDrift, evaluateHealthEvidence,
  evaluatePitr, evaluateSmtp, runGolivePreflight, sentryConfigPresent,
} from './golive-preflight.ts'

const okEv = { ok: true, detail: 'ok' }

const green = {
  gate0InventoryPath: 'docs/ops/inventory-latest.json',
  ciConclusion: 'success' as const,
  pgtapConclusion: 'success' as const,
  productionHealth: 'success' as const,
  sentryConfigured: true,
  demoStringInAppsSrc: false,
  appArtifactTrackedInGit: false,
  full: false,
  remote: { drift: okEv, pitr: okEv, authHook: okEv, smtp: okEv, cron: okEv },
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
  assert.equal((await runGolivePreflight({ ...green, demoStringInAppsSrc: true })).ready, false)
  assert.equal((await runGolivePreflight({ ...green, appArtifactTrackedInGit: true })).ready, false)
})

test('collectLocalEvidence detecta DEMO_MODE en cualquier app y apk/aab', () => {
  const demo = collectLocalEvidence({
    srcFiles: [{ path: 'apps/mobile/src/x.ts', content: 'const DEMO_MODE = true' }],
    gitTracked: ['apps/web/src/x.ts'],
  })
  assert.equal(demo.demoStringInAppsSrc, true)
  assert.equal(demo.appArtifactTrackedInGit, false)

  const enTest = collectLocalEvidence({
    srcFiles: [{ path: 'apps/backoffice/src/a.test.ts', content: "assert(!s.includes('DEMO_MODE'))" }],
    gitTracked: ['releases/app.aab'],
  })
  assert.equal(enTest.demoStringInAppsSrc, false)
  assert.equal(enTest.appArtifactTrackedInGit, true)
})

test('go-live completo exige evidencia operativa; el deploy no', async () => {
  const sinPitr = { ...green.remote, pitr: { ok: false, detail: 'enabled=false' } }
  assert.equal((await runGolivePreflight({ ...green, remote: sinPitr })).ready, true)
  const full = await runGolivePreflight({ ...green, full: true, remote: sinPitr })
  assert.equal(full.ready, false)
  assert.deepEqual(full.checks.slice(6).map((c) => c.id), ['migrations-drift', 'pitr', 'auth-hook', 'smtp', 'cron'])
})

test('evaluadores remotos', () => {
  assert.equal(evaluateDrift(['1', '2', '3'], ['1', '2']).ok, true, 'pendientes locales se permiten')
  assert.equal(evaluateDrift(['1'], ['1', '9']).ok, false)
  assert.equal(evaluatePitr({ pitr_enabled: true, pitr_retention_days: 7 }).ok, true)
  assert.equal(evaluatePitr({ pitr_enabled: false }).ok, false)
  assert.equal(evaluateSmtp({ smtp_host: 'smtp.example.com' }).ok, true)
  assert.equal(evaluateSmtp({ smtp_host: '' }).ok, false)
  assert.equal(evaluateCron([{ jobname: 'a', ultimo: 'succeeded' }, { jobname: 'anual', ultimo: null }]).ok, true)
  assert.equal(evaluateCron([{ jobname: 'agenda', ultimo: 'failed' }]).ok, false)
  assert.equal(evaluateCron([]).ok, false)
})

test('supabase-prod exige preflight, workflow_dispatch y production', () => {
  const y = readFileSync('.github/workflows/supabase-prod.yml', 'utf8')
  assert.match(y, /workflow_dispatch/)
  assert.doesNotMatch(y, /on:\s*\n\s*push:/)
  assert.match(y, /environment:\s*production/)
  assert.match(y, /golive-preflight/)
})
