import assert from 'node:assert/strict'
import test from 'node:test'
import { apiFetch } from '../src/lib/api.ts'
import { formatError } from '../src/lib/erroresUi.ts'
import { headersConRequestId, lastRequestId, newRequestContext } from '../src/lib/requestContext.ts'
import { initSentry, scrubSentryEvent } from '../src/lib/sentry.ts'

test('formatError incluye código GC-*', () => {
  const out = formatError(new Error('GC-CORE-001: sin backend'))
  assert.equal(out.code, 'GC-CORE-001')
  assert.match(out.message, /configuración pública|backend|GC-CORE-001/i)
})

test('formatError adjunta request_id', () => {
  const out = formatError(new Error('GC-AUTH-001'), 'req-123')
  assert.equal(out.requestId, 'req-123')
  assert.equal(out.code, 'GC-AUTH-001')
})

test('headersConRequestId setea x-request-id', () => {
  const ctx = newRequestContext()
  const h = headersConRequestId({ Accept: 'application/json' }, ctx)
  assert.equal(h.get('x-request-id'), ctx.requestId)
  assert.match(ctx.requestId, /^[0-9a-f-]{36}$/i)
})

test('initSentry exige DSN', () => {
  assert.throws(
    () => initSentry({ dsn: '', environment: 'local', release: 't' }),
    /GC-CORE-001/,
  )
})

test('initSentry acepta sentryDsn de requireBuildEnv', () => {
  const cfg = initSentry({
    sentryDsn: 'https://public@o0.ingest.sentry.io/1',
    environment: 'staging',
    release: 'gate-3',
  })
  assert.equal(cfg.dsn, 'https://public@o0.ingest.sentry.io/1')
})

test('apiFetch envía x-request-id', async () => {
  const orig = globalThis.fetch
  let seen: string | null = null
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    seen = new Headers(init?.headers).get('x-request-id')
    return new Response('ok')
  }) as typeof fetch
  try {
    await apiFetch('https://example.test/rpc')
    assert.match(seen ?? '', /^[0-9a-f-]{36}$/i)
    assert.equal(lastRequestId(), seen)
  } finally {
    globalThis.fetch = orig
  }
})

test('scrubSentryEvent quita PII y secretos', () => {
  const event = scrubSentryEvent({
    extra: {
      email: 'a@b.com',
      password: 'secret',
      token: 'jwt',
      documento: '123',
      lat: 14.6,
      lng: -90.5,
      request_id: 'r1',
    },
    tags: { tenant_id: 't1', request_id: 'r1' },
  })
  assert.equal(event.extra?.email, undefined)
  assert.equal(event.extra?.password, undefined)
  assert.equal(event.extra?.token, undefined)
  assert.equal(event.extra?.documento, undefined)
  assert.equal(event.extra?.lat, undefined)
  assert.equal(event.extra?.request_id, 'r1')
  assert.equal(event.tags?.tenant_id, 't1')
})
