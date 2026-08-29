import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  credencialesPublicasValidas,
  mensajePreviewSinBackend,
  varsFaltantesSupabase,
} from '../src/lib/supabaseEnv.ts'

test('sin URL ni key no hay backend', () => {
  assert.equal(credencialesPublicasValidas(undefined, undefined), false)
  assert.deepEqual(varsFaltantesSupabase('', ''), [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ])
})

test('placeholders de .env.example no activan el cliente', () => {
  assert.equal(
    credencialesPublicasValidas(
      'https://xcoeipsnykceorcvjwve.supabase.co',
      'tu-anon-key',
    ),
    false,
  )
  assert.equal(
    credencialesPublicasValidas(
      'https://xcoeipsnykceorcvjwve.supabase.co',
      'tu_anon_key_aqui',
    ),
    false,
  )
})

test('URL + JWT anon reales sí configuran el cliente', () => {
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MSwiZXhwIjoxfQ.ok'
  assert.equal(
    credencialesPublicasValidas('https://xcoeipsnykceorcvjwve.supabase.co', jwt),
    true,
  )
  assert.deepEqual(varsFaltantesSupabase('https://xcoeipsnykceorcvjwve.supabase.co', jwt), [])
})

test('mensaje de preview lista exactamente lo que falta', () => {
  const msg = mensajePreviewSinBackend(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'])
  assert.match(msg, /preview DEMO/)
  assert.match(msg, /EXPO_PUBLIC_SUPABASE_URL/)
  assert.match(msg, /EXPO_PUBLIC_SUPABASE_ANON_KEY/)
  assert.match(msg, /no está conectado al backend/)
})

test('si hay credenciales el mensaje no dice sin backend', () => {
  const msg = mensajePreviewSinBackend([])
  assert.match(msg, /Conectado a Supabase/)
  assert.doesNotMatch(msg, /no está conectado/)
})
