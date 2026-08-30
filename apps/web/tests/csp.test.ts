import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('index.html no tiene script-src unsafe-inline', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const m = html.match(/script-src[^;"]+/)
  assert.ok(m, 'falta script-src en CSP')
  assert.equal(/unsafe-inline/.test(m[0]), false, m[0])
  assert.match(html, /connect-src[^"]*sentry\.io/)
})
