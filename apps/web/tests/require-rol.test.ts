import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccess, decisionGuardRol } from '../src/lib/claims.ts'

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

test('decisionGuardRol espera mientras loading (H3/H5/H6/H7)', () => {
  assert.equal(decisionGuardRol(true, '/mapa', undefined), 'loading')
  assert.equal(decisionGuardRol(true, '/configuracion', 'admin'), 'loading')
  assert.equal(decisionGuardRol(true, '/usuarios', 'admin'), 'loading')
  assert.equal(decisionGuardRol(true, '/auditoria', 'admin'), 'loading')
})

test('decisionGuardRol no deniega al admin hasta hidratar el rol', () => {
  assert.equal(decisionGuardRol(false, '/mapa', 'admin'), 'allow')
  assert.equal(decisionGuardRol(false, '/configuracion', 'admin'), 'allow')
  assert.equal(decisionGuardRol(false, '/usuarios', 'admin'), 'allow')
  assert.equal(decisionGuardRol(false, '/auditoria', 'admin'), 'allow')
  assert.equal(decisionGuardRol(false, '/mapa', 'asesor'), 'deny')
  assert.equal(decisionGuardRol(false, '/configuracion', undefined), 'deny')
})
