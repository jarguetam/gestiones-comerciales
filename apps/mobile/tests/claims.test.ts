import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { claimsDe, claimsEmpresaDe } from '../src/lib/claims.ts'

function jwtCon(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.sig`
}

test('lee tenant y rol desde la raíz del JWT (hook custom_access_token)', () => {
  const token = jwtCon({ tenant_id: 't1', rol: 'asesor' })
  const claims = claimsDe(token)
  assert.deepEqual(claims, { tenantId: 't1', rol: 'asesor' })
})

test('lee tenant y rol desde app_metadata embebido en el JWT', () => {
  const token = jwtCon({
    sub: 'u1',
    app_metadata: { tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', rol: 'asesor' },
  })
  assert.notEqual(token.split('.')[1].length % 4, 0)
  const claims = claimsDe(token)
  assert.equal(claims?.tenantId, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  assert.equal(claims?.rol, 'asesor')
})

test('JWT típico de GoTrue (sin padding, email, app_metadata) no revienta el decoder', () => {
  const token = jwtCon({
    aud: 'authenticated',
    exp: 1893456000,
    iss: 'https://xcoeipsnykceorcvjwve.supabase.co/auth/v1',
    sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'asesor@gestionescomerciales.com',
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      tenant_id: 't-empresa',
      rol: 'asesor',
    },
    user_metadata: { nombre: 'José Peña' },
    role: 'authenticated',
  })
  assert.equal(token.split('.')[1].includes('='), false)
  const claims = claimsDe(token)
  assert.equal(claims?.tenantId, 't-empresa')
  assert.equal(claims?.rol, 'asesor')
})

test('prioriza app_metadata de session.user como la web', () => {
  const claims = claimsEmpresaDe({
    accessToken: jwtCon({ role: 'authenticated' }),
    appMetadata: { tenant_id: 'desde-user', rol: 'gerente' },
  })
  assert.deepEqual(claims, { tenantId: 'desde-user', rol: 'gerente' })
})

test('si el JWT llega vacío, usa tenant_id_actual / rol_actual (fallback web)', () => {
  const claims = claimsEmpresaDe({
    accessToken: jwtCon({ role: 'authenticated' }),
    appMetadata: {},
    tenantIdDb: 't-db',
    rolDb: 'asesor',
  })
  assert.deepEqual(claims, { tenantId: 't-db', rol: 'asesor' })
})

test('sin tenant ni rol en JWT, user ni DB → null (GC-AUTH-021)', () => {
  assert.equal(claimsDe(jwtCon({ role: 'authenticated' })), null)
  assert.equal(claimsEmpresaDe({ accessToken: 'no-es-un-jwt', appMetadata: {} }), null)
})
