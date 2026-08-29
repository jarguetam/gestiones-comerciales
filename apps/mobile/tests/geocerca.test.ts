import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { distanciaMetros, fueraDeRango } from '../src/lib/geocerca.ts'

test('distanciaMetros ~0 en el mismo punto', () => {
  assert.ok(distanciaMetros(14.63, -90.51, 14.63, -90.51) < 1)
})

test('fueraDeRango no bloquea: solo marca umbral', () => {
  const d = distanciaMetros(14.63, -90.51, 14.64, -90.51)
  assert.ok(d > 200)
  assert.equal(fueraDeRango(d, 200), true)
  assert.equal(fueraDeRango(50, 200), false)
})
