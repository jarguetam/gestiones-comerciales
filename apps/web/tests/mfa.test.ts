import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { requierePasoTotp } from '../src/features/auth/mfa.ts'

test('requierePasoTotp solo si hay que subir de aal1 a aal2', () => {
  assert.equal(requierePasoTotp({ currentLevel: 'aal1', nextLevel: 'aal2' }), true)
  assert.equal(requierePasoTotp({ currentLevel: 'aal2', nextLevel: 'aal2' }), false)
  assert.equal(requierePasoTotp({ currentLevel: 'aal1', nextLevel: 'aal1' }), false)
  assert.equal(requierePasoTotp(null), false)
})
