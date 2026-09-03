import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { edgeSmokeOk, evaluatePagesHtml } from './pages-smoke.ts'

test('pages-smoke ok si hay login y no hay demo', () => {
  const r = evaluatePagesHtml('<h1>Ruta de campo</h1><button>Ingresar</button>')
  assert.equal(r.ok, true)
})

test('pages-smoke falla si aparece Entrar al tablero', () => {
  const r = evaluatePagesHtml('<button>Ingresar</button><button>Entrar al tablero</button>')
  assert.equal(r.ok, false)
  assert.match(r.detail, /Entrar al tablero|GC-OPS-009/)
})

test('pages-smoke falla si falta Ingresar', () => {
  const r = evaluatePagesHtml('<h1>Ruta de campo</h1>')
  assert.equal(r.ok, false)
  assert.match(r.detail, /Ingresar|GC-OPS-009/)
})

test('auth-guard sin JWT acepta 401 o 400', () => {
  assert.equal(edgeSmokeOk(401), true)
  assert.equal(edgeSmokeOk(400), true)
  assert.equal(edgeSmokeOk(200), false)
})

test('pages-smoke.sh delega en curl y anti-demo', () => {
  const sh = readFileSync('scripts/ops/pages-smoke.sh', 'utf8')
  assert.match(sh, /Ingresar/)
  assert.match(sh, /Entrar al tablero/)
  assert.match(sh, /auth-guard/)
  const pages = readFileSync('.github/workflows/pages-prod.yml', 'utf8')
  assert.match(pages, /pages-smoke\.sh/)
})
