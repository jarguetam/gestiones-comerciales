import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RUTAS_AUTH, RUTAS_PUBLICAS, rutasParaModo } from './qa-paseo/rutas.ts'
import { Recolector, formatearReporteMd, type Hallazgo } from './qa-paseo/hallazgos.ts'

test('catálogo público incluye login y recuperar', () => {
  const paths = RUTAS_PUBLICAS.map((r) => r.path)
  assert.ok(paths.includes('/login'))
  assert.ok(paths.includes('/recuperar'))
  assert.equal(RUTAS_PUBLICAS.find((r) => r.path === '/login')?.spec, 'W-01')
})

test('catálogo auth cubre pantallas admin W-02..W-15', () => {
  const specs = new Set(RUTAS_AUTH.map((r) => r.spec).filter(Boolean))
  for (const id of ['W-02', 'W-03', 'W-04', 'W-05', 'W-06', 'W-07', 'W-08', 'W-09', 'W-10', 'W-11', 'W-12', 'W-13', 'W-14', 'W-15']) {
    assert.ok(specs.has(id), `falta spec ${id}`)
  }
  assert.ok(RUTAS_AUTH.some((r) => r.path === '/'))
  assert.ok(RUTAS_AUTH.some((r) => r.path === '/usuarios'))
})

test('rutasParaModo filtra public vs auth', () => {
  assert.deepEqual(
    rutasParaModo('public').map((r) => r.modo),
    ['public', 'public'],
  )
  assert.ok(rutasParaModo('auth').every((r) => r.modo === 'auth'))
  assert.ok(rutasParaModo('auth').length >= 14)
})

test('Recolector acumula y no dedupea distintos tipos', () => {
  const r = new Recolector()
  r.add({ tipo: 'axe', severidad: 'high', ruta: '/visitas', mensaje: 'button-name' })
  r.add({ tipo: 'console', severidad: 'medium', ruta: '/crm', mensaje: 'TypeError' })
  assert.equal(r.todos().length, 2)
  assert.equal(r.porSeveridad('high').length, 1)
})

test('formatearReporteMd lista hallazgos', () => {
  const items: Hallazgo[] = [
    { tipo: 'blank', severidad: 'high', ruta: '/mapa', mensaje: 'contenido vacío' },
    { tipo: 'control', severidad: 'medium', ruta: '/crm', mensaje: 'botón sin nombre', evidencia: 'button.nth(2)' },
  ]
  const md = formatearReporteMd({ baseUrl: 'https://example.test/', modo: 'auth', hallazgos: items })
  assert.match(md, /qa-paseo/)
  assert.match(md, /\/mapa/)
  assert.match(md, /button\.nth\(2\)/)
  assert.match(md, /2 hallazgo/)
})

test('formatearReporteMd sin hallazgos dice limpio', () => {
  const md = formatearReporteMd({ baseUrl: 'http://localhost/', modo: 'public', hallazgos: [] })
  assert.match(md, /sin hallazgos/i)
})
