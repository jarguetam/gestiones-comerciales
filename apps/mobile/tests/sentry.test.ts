import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { initSentryMobile, resolverInitSentry } from '../src/lib/sentry.ts'

test('init no crashea sin DSN en test env', async () => {
  const cfg = resolverInitSentry({
    NODE_ENV: 'test',
    EXPO_PUBLIC_ENVIRONMENT: 'production',
    EXPO_PUBLIC_SENTRY_DSN: '',
  })
  assert.equal(cfg.enabled, false)
  const r = await initSentryMobile({ NODE_ENV: 'test', EXPO_PUBLIC_SENTRY_DSN: undefined })
  assert.equal(r.enabled, false)
})

test('build prod sin DSN lanza GC-CORE-001', () => {
  assert.throws(
    () =>
      resolverInitSentry({
        NODE_ENV: 'production',
        EXPO_PUBLIC_ENVIRONMENT: 'production',
      }),
    /GC-CORE-001/,
  )
})

test('DSN presente habilita Sentry', () => {
  const cfg = resolverInitSentry({
    EXPO_PUBLIC_SENTRY_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    EXPO_PUBLIC_ENVIRONMENT: 'production',
  })
  assert.equal(cfg.enabled, true)
})
