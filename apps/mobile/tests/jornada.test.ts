import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { formatearFechaJornada, progresoJornada } from '../src/lib/jornada.ts'

test('progresoJornada de campo cuenta hechas', () => {
  const p = progresoJornada([{ estado: 'programada' }, { estado: 'completada' }])
  assert.equal(p.pct, 50)
  assert.equal(p.hechas, 1)
})

test('formatearFechaJornada en español', () => {
  assert.match(formatearFechaJornada('2026-09-17'), /septiembre/i)
})
