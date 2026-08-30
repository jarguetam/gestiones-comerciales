import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccess } from '../src/lib/claims.ts'

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
