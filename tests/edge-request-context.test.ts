import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('cada Edge index.ts importa readRequestContext', () => {
  const dirs = readdirSync('supabase/functions', { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
  assert.equal(dirs.length, 8)
  for (const name of dirs) {
    const src = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8')
    assert.match(src, /readRequestContext/, name)
  }
})
