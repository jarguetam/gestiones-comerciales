import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { esErrorTransitorio } from '../src/lib/errorRed.ts'

for (const [err, esperado] of [
  [{ message: 'TypeError: Network request failed' }, true],
  [new TypeError('Failed to fetch'), true],
  [{ message: 'fetch failed' }, true],
  [{ code: 'PGRST301', message: 'JWT expired' }, true],
  [{ code: 'P0001', message: 'GC-VIS-002: falta oficina' }, false],
  [{ code: '23505', message: 'duplicate key' }, false],
] as const) {
  test(`esErrorTransitorio(${JSON.stringify(err)})`, () => assert.equal(esErrorTransitorio(err), esperado))
}

test('esErrorTransitorio tolera valores que no son Error', () => {
  assert.equal(esErrorTransitorio(null), false)
  assert.equal(esErrorTransitorio(undefined), false)
  assert.equal(esErrorTransitorio('Network request failed'), true)
  assert.equal(esErrorTransitorio('otra cosa'), false)
  assert.equal(esErrorTransitorio(42), false)
  assert.equal(esErrorTransitorio(new DOMException('aborted', 'AbortError')), true)
})
