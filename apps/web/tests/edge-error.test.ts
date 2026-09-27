import assert from 'node:assert/strict'
import test from 'node:test'
import { mensajeErrorEdge } from '../src/lib/erroresUi.ts'

test('muestra el codigo GC de una Edge Function con respuesta HTTP fallida', async () => {
  const error = {
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(JSON.stringify({ error: 'GC-AUTH-001: requiere superadmin de plataforma' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }),
  }

  assert.equal(await mensajeErrorEdge(error), 'GC-AUTH-001: requiere superadmin de plataforma')
})

test('conserva el error original si la respuesta no contiene un codigo GC', async () => {
  const error = {
    message: 'Edge Function returned a non-2xx status code',
    context: new Response('error interno', { status: 500 }),
  }

  assert.equal(await mensajeErrorEdge(error), error.message)
})
