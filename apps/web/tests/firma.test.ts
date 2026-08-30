import assert from 'node:assert/strict'
import test from 'node:test'
import { cancelStroke, endStroke, startStroke, type FirmaStroke } from '../src/lib/firmaStroke.ts'

test('pointercancel limpia stroke in-progress', () => {
  const s: FirmaStroke = { activo: false }
  startStroke(s)
  assert.equal(s.activo, true)
  cancelStroke(s)
  assert.equal(s.activo, false)
})

test('endStroke confirma el trazo (pointerup)', () => {
  const s: FirmaStroke = { activo: false }
  startStroke(s)
  endStroke(s)
  assert.equal(s.activo, false)
})
