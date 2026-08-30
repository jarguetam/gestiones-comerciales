import { readFileSync, globSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('e2e no usa el botón demo para entrar', () => {
  const specs = [
    ...globSync('apps/web/tests/**/*.spec.ts'),
    ...globSync('apps/backoffice/tests/**/*.spec.ts'),
  ]
  for (const f of specs) {
    const s = readFileSync(f, 'utf8')
    assert.doesNotMatch(s, /getByRole\([^)]*entrar al (tablero|backoffice)[^)]*\)\s*\.(click|tap)/i, f)
    assert.doesNotMatch(s, /getByText\([^)]*Entrar al (tablero|backoffice)/, f)
  }
})
