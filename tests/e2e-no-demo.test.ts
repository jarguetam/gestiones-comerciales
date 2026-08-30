import { readFileSync, globSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('e2e no usa Entrar al tablero', () => {
  const specs = globSync('apps/web/tests/**/*.spec.ts')
  for (const f of specs) {
    assert.equal(readFileSync(f, 'utf8').includes('Entrar al tablero'), false, f)
  }
})
