import assert from 'node:assert/strict'
import test from 'node:test'
import { assertToolchain } from './toolchain.ts'
test('rechaza node 20', () => {
  assert.throws(() => assertToolchain({ node: '20.20.2', pnpm: '9.15.9' }), /GC-OPS-010/)
})
