import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

test('sentry-release dry-run no falla sin red ni token', () => {
  const out = execFileSync('bash', ['scripts/ops/sentry-release.sh', 'web@abc1234'], {
    encoding: 'utf8',
    env: { ...process.env, SENTRY_DRY_RUN: '1' },
  })
  assert.match(out, /dry-run/)
  assert.match(out, /web@abc1234/)
})

test('sentry-release exige nombre de release', () => {
  assert.throws(
    () =>
      execFileSync('bash', ['scripts/ops/sentry-release.sh'], {
        encoding: 'utf8',
        env: { ...process.env, SENTRY_DRY_RUN: '1' },
      }),
    /usage/,
  )
})

test('workflow Sentry corre tras Pages y soporta EAS', () => {
  const y = readFileSync('.github/workflows/ops-sentry-release.yml', 'utf8')
  assert.match(y, /workflow_dispatch/)
  assert.match(y, /sentry-release\.sh/)
  assert.match(y, /22\.14\.0/)
  const pages = readFileSync('.github/workflows/pages-prod.yml', 'utf8')
  assert.match(pages, /sentry-release\.sh/)
  assert.match(pages, /web@/)
  assert.match(pages, /backoffice@/)
})
