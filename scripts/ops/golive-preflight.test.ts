import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { collectLocalEvidence, runGolivePreflight } from './golive-preflight.ts'

const green = {
  gate0InventoryPath: 'docs/ops/inventory-latest.json',
  ciConclusion: 'success' as const,
  pgtapConclusion: 'success' as const,
  stagingHealth: 'success' as const,
  sentryReleaseExists: true,
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
    ['ci', 'pgtap', 'staging-health', 'sentry-release', 'no-demo', 'no-apk-git'],
  )
  assert.ok(ok.checks.every((c) => c.ok))
})

test('unknown en CI no es ready', async () => {
  const r = await runGolivePreflight({ ...green, ciConclusion: 'unknown' })
  assert.equal(r.ready, false)
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
