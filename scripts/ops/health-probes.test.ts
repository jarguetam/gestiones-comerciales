import assert from 'node:assert/strict'
import test from 'node:test'
import { htmlContainsDemoBoard, probeOk } from './health-probes.ts'

test('parser HTML detecta el botón demo', () => {
  assert.equal(htmlContainsDemoBoard('<button>Entrar al tablero</button>'), true)
  assert.equal(htmlContainsDemoBoard('<h1>Ruta de campo</h1>'), false)
})

test('probeOk acepta 200 Pages y 4xx de auth-guard, no 5xx', () => {
  assert.equal(probeOk({ kind: 'pages', status: 200 }), true)
  assert.equal(probeOk({ kind: 'pages', status: 500 }), false)
  assert.equal(probeOk({ kind: 'auth-guard', status: 401 }), true)
  assert.equal(probeOk({ kind: 'auth-guard', status: 400 }), true)
  assert.equal(probeOk({ kind: 'auth-guard', status: 502 }), false)
  assert.equal(probeOk({ kind: 'postgrest', status: 401 }), true)
  assert.equal(probeOk({ kind: 'postgrest', status: 200 }), true)
  assert.equal(probeOk({ kind: 'postgrest', status: 500 }), false)
})
