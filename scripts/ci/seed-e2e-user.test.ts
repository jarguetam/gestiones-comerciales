import assert from 'node:assert/strict'
import test from 'node:test'
import { stagingUsersFromEnv } from './seed-e2e-user.ts'

test('stagingUsersFromEnv exige passwords en secrets', () => {
  assert.throws(() => stagingUsersFromEnv({}), /GC-OPS-008/)
})

test('stagingUsersFromEnv usa correos sintéticos', () => {
  const users = stagingUsersFromEnv({
    E2E_ASESOR_PASSWORD: 'x',
    E2E_ADMIN_PASSWORD: 'y',
  })
  assert.deepEqual(
    users.map((u) => u.email),
    ['asesor@staging.test', 'admin@staging.test'],
  )
})
