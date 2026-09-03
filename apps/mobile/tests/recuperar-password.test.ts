import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const src = readFileSync(new URL('../src/screens/RecuperarPasswordScreen.tsx', import.meta.url), 'utf8')

test('RecuperarPasswordScreen no tiene switch demo', () => {
  assert.equal(src.includes('Switch'), false)
  assert.equal(src.includes('DEMO_MODE'), false)
  assert.equal(src.includes('Entrar al tablero'), false)
  assert.match(src, /resetPasswordForEmail/)
  assert.match(src, /gc:\/\/recuperar/)
})
