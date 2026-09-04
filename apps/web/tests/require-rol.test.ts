import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccess } from '../src/lib/claims.ts'
import { decidirAccesoRuta } from '../src/lib/claims.ts'

test('canAccess: /configuracion solo admin (W-10)', () => {
  assert.equal(canAccess('/configuracion', 'admin'), true)
  assert.equal(canAccess('/configuracion/rastreo', 'admin'), true)
  assert.equal(canAccess('/configuracion', 'gerente'), false)
  assert.equal(canAccess('/configuracion', 'supervisor'), false)
  assert.equal(canAccess('/configuracion', 'asesor'), false)
  assert.equal(canAccess('/configuracion', undefined), false)
})

test('canAccess: /usuarios admin o gerente (W-11)', () => {
  assert.equal(canAccess('/usuarios', 'admin'), true)
  assert.equal(canAccess('/usuarios', 'gerente'), true)
  assert.equal(canAccess('/usuarios', 'supervisor'), false)
  assert.equal(canAccess('/usuarios', 'asesor'), false)
})

test('canAccess: /auditoria solo admin; resto abierto', () => {
  assert.equal(canAccess('/auditoria', 'admin'), true)
  assert.equal(canAccess('/auditoria', 'asesor'), false)
  assert.equal(canAccess('/visitas', 'asesor'), true)
  assert.equal(canAccess('/mapa', 'asesor'), false)
  assert.equal(canAccess('/mapa', 'supervisor'), true)
})

test('decidirAccesoRuta espera loading antes de denegar (H3/H5–H7)', () => {
  assert.equal(decidirAccesoRuta({ loading: true, path: '/mapa', rol: undefined }), 'loading')
  assert.equal(decidirAccesoRuta({ loading: true, path: '/mapa', rol: 'admin' }), 'loading')
  assert.equal(decidirAccesoRuta({ loading: false, path: '/mapa', rol: 'admin' }), 'allow')
  assert.equal(decidirAccesoRuta({ loading: false, path: '/mapa', rol: undefined }), 'deny')
  assert.equal(decidirAccesoRuta({ loading: false, path: '/configuracion', rol: 'asesor' }), 'deny')
})
