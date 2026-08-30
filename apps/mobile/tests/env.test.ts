import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { requireMobileEnv } from '../src/lib/env.ts'

const URL = 'https://xcoeipsnykceorcvjwve.supabase.co'
const KEY = 'anon-public-test-key-mas-de-20'

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  }
  try {
    if (vars.EXPO_PUBLIC_SUPABASE_URL === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL
    else process.env.EXPO_PUBLIC_SUPABASE_URL = vars.EXPO_PUBLIC_SUPABASE_URL
    if (vars.EXPO_PUBLIC_SUPABASE_ANON_KEY === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = vars.EXPO_PUBLIC_SUPABASE_ANON_KEY
    if (vars.EXPO_PUBLIC_SENTRY_DSN === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN
    else process.env.EXPO_PUBLIC_SENTRY_DSN = vars.EXPO_PUBLIC_SENTRY_DSN
    fn()
  } finally {
    if (prev.url === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL
    else process.env.EXPO_PUBLIC_SUPABASE_URL = prev.url
    if (prev.key === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = prev.key
    if (prev.dsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN
    else process.env.EXPO_PUBLIC_SENTRY_DSN = prev.dsn
  }
}

test('requireMobileEnv lanza GC-CORE-001 si falta URL o anon key', () => {
  withEnv({ EXPO_PUBLIC_SUPABASE_URL: undefined, EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined }, () => {
    assert.throws(() => requireMobileEnv(), /GC-CORE-001/)
  })
  withEnv({ EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined }, () => {
    assert.throws(() => requireMobileEnv(), /GC-CORE-001/)
  })
  withEnv({ EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'tu-anon-key-o-publishable-key' }, () => {
    assert.throws(() => requireMobileEnv(), /GC-CORE-001/)
  })
})

test('requireMobileEnv devuelve url, key y sentryDsn cuando el env es válido', () => {
  withEnv(
    {
      EXPO_PUBLIC_SUPABASE_URL: URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: KEY,
      EXPO_PUBLIC_SENTRY_DSN: 'https://example.ingest.sentry.io/1',
    },
    () => {
      const env = requireMobileEnv()
      assert.equal(env.url, URL)
      assert.equal(env.key, KEY)
      assert.equal(env.sentryDsn, 'https://example.ingest.sentry.io/1')
    },
  )
})
