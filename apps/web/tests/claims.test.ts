import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { claimsDeUsuario, mostrarAuditoria, mostrarConfiguracion, mostrarUsuarios } from '../src/lib/claims.ts'

function jwtCon(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.sig`
}

test('admin con app_metadata.rol ve Configuración', () => {
  const claims = claimsDeUsuario({ app_metadata: { rol: 'admin', tenant_id: 't1' } })
  assert.equal(claims.rol, 'admin')
  assert.equal(mostrarConfiguracion(claims.rol), true)
})

test('sin claims en app_metadata ni JWT no muestra Configuración', () => {
  const claims = claimsDeUsuario({ app_metadata: {} })
  assert.equal(claims.rol, undefined)
  assert.equal(mostrarConfiguracion(claims.rol), false)
})

test('asesor no ve Configuración', () => {
  assert.equal(mostrarConfiguracion('asesor'), false)
  assert.equal(mostrarUsuarios('asesor'), false)
})

test('gerente ve Usuarios pero no Configuración', () => {
  assert.equal(mostrarConfiguracion('gerente'), false)
  assert.equal(mostrarUsuarios('gerente'), true)
})

test('sin rol no muestra Configuración', () => {
  assert.equal(mostrarConfiguracion(undefined), false)
})

test('solo admin ve Auditoría (W-12)', () => {
  assert.equal(mostrarAuditoria('admin'), true)
  assert.equal(mostrarAuditoria('gerente'), false)
  assert.equal(mostrarAuditoria('asesor'), false)
  assert.equal(mostrarAuditoria(undefined), false)
})

test('hidrata rol desde la raíz del JWT (hook custom_access_token)', () => {
  const token = jwtCon({ sub: 'u1', rol: 'admin', tenant_id: 't1' })
  const claims = claimsDeUsuario({ app_metadata: {} }, token)
  assert.equal(claims.rol, 'admin')
  assert.equal(claims.tenantId, 't1')
  assert.equal(mostrarConfiguracion(claims.rol), true)
})

test('hidrata rol desde app_metadata embebido en el JWT', () => {
  const token = jwtCon({ sub: 'u1', app_metadata: { rol: 'admin', tenant_id: 't1' } })
  const claims = claimsDeUsuario({ app_metadata: {} }, token)
  assert.equal(claims.rol, 'admin')
  assert.equal(claims.tenantId, 't1')
})
