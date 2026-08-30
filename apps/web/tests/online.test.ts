import assert from 'node:assert/strict'
import test from 'node:test'
import { canMutate, isBrowserOnline } from '../src/lib/online.ts'

test('canMutate(false) === false', () => {
  assert.equal(canMutate(false), false)
  assert.equal(canMutate(true), true)
})

test('isBrowserOnline respeta navigator.onLine', () => {
  assert.equal(isBrowserOnline({ onLine: false }), false)
  assert.equal(isBrowserOnline({ onLine: true }), true)
})
