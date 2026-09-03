import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('src no hardcodea xcoeipsnykceorcvjwve', () => {
  const files = globSync('apps/{web,backoffice,mobile}/src/**/*.{ts,tsx}')
  for (const f of files) {
    assert.equal(readFileSync(f, 'utf8').includes('xcoeipsnykceorcvjwve'), false, f)
  }
})
