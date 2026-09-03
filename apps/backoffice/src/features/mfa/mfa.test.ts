import assert from 'node:assert/strict'
import test from 'node:test'
import { plataformaRolDe, resolveBackofficeAccess } from '../../lib/plataformaRol.ts'

function sessionCon(meta: Record<string, unknown>) {
  return { user: { app_metadata: meta } }
}

test('sin sesión → login', () => {
  assert.equal(resolveBackofficeAccess({ session: null, factors: { totp: [] }, aal: 'aal1' }), 'login')
})

test('JWT de empresa sin claim plataforma → forbidden', () => {
  const session = sessionCon({ tenant_id: 't1', rol: 'admin' })
  assert.equal(resolveBackofficeAccess({ session, factors: { totp: [{ id: 'f1' }] }, aal: 'aal2' }), 'forbidden')
  assert.equal(plataformaRolDe(session), null)
})

test('claim plataforma actual (schema F0) admite owner/operador', () => {
  assert.equal(plataformaRolDe(sessionCon({ plataforma: true, superadmin: true })), 'owner')
  assert.equal(plataformaRolDe(sessionCon({ plataforma: true, superadmin: false })), 'operador')
  assert.equal(plataformaRolDe(sessionCon({ plataforma_rol: 'owner' })), 'owner')
  assert.equal(plataformaRolDe(sessionCon({ plataforma_rol: 'operador' })), 'operador')
})

test('plataforma sin TOTP → enroll_mfa', () => {
  const session = sessionCon({ plataforma: true, superadmin: true })
  assert.equal(resolveBackofficeAccess({ session, factors: { totp: [] }, aal: 'aal1' }), 'enroll_mfa')
})

test('plataforma con TOTP y AAL1 → challenge_mfa', () => {
  const session = sessionCon({ plataforma: true })
  assert.equal(
    resolveBackofficeAccess({ session, factors: { totp: [{ id: 'f1' }] }, aal: 'aal1' }),
    'challenge_mfa',
  )
})

test('plataforma con TOTP y AAL2 → ok', () => {
  const session = sessionCon({ plataforma: true, superadmin: false })
  assert.equal(
    resolveBackofficeAccess({ session, factors: { totp: [{ id: 'f1' }] }, aal: 'aal2' }),
    'ok',
  )
})
