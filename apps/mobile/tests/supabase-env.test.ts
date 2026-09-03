import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  credencialesPublicasValidas,
  mensajePreviewSinBackend,
  varsFaltantesSupabase,
} from '../src/lib/supabaseEnv.ts'

test('sin EXPO_PUBLIC_* el mensaje lista las dos variables', () => {
  const falta = varsFaltantesSupabase(undefined, undefined)
  assert.deepEqual(falta, ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'])
  const msg = mensajePreviewSinBackend(falta)
  assert.match(msg, /GC-CORE-001/)
  assert.match(msg, /EXPO_PUBLIC_SUPABASE_URL/)
  assert.match(msg, /EXPO_PUBLIC_SUPABASE_ANON_KEY/)
})

test('placeholder de .env.example no cuenta como backend', () => {
  assert.equal(
    credencialesPublicasValidas('https://xcoeipsnykceorcvjwve.supabase.co', 'tu-anon-key-o-publishable-key'),
    false,
  )
})

test('URL + JWT anon reales no dicen sin backend', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.okxx'
  assert.equal(credencialesPublicasValidas('https://xcoeipsnykceorcvjwve.supabase.co', jwt), true)
  assert.match(mensajePreviewSinBackend([]), /Conectado a Supabase/)
  assert.equal(mensajePreviewSinBackend([]).includes('demostración'), false)
})
