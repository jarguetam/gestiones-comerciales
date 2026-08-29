import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  enVentanaHoraria,
  intervaloMs,
  loteListo,
  tomarLote,
  puntoDesdeCoords,
} from '../src/lib/rastreo.ts'

test('enVentanaHoraria respeta inicio y fin del tenant', () => {
  assert.equal(enVentanaHoraria('08:00:00', '07:00', '18:00'), true)
  assert.equal(enVentanaHoraria('06:59:59', '07:00:00', '18:00:00'), false)
  assert.equal(enVentanaHoraria('18:00:00', '07:00:00', '18:00:00'), true)
  assert.equal(enVentanaHoraria('18:00:01', '07:00:00', '18:00:00'), false)
})

test('intervaloMs acota entre 1 y 240 minutos', () => {
  assert.equal(intervaloMs(15), 15 * 60_000)
  assert.equal(intervaloMs(0), 60_000)
  assert.equal(intervaloMs(999), 240 * 60_000)
  assert.equal(intervaloMs(undefined), 15 * 60_000)
})

test('tomarLote no pierde puntos al extraer el batch', () => {
  const puntos = [
    puntoDesdeCoords({ latitude: 1, longitude: 1, timestamp: 1 }),
    puntoDesdeCoords({ latitude: 2, longitude: 2, timestamp: 2 }),
    puntoDesdeCoords({ latitude: 3, longitude: 3, timestamp: 3 }),
    puntoDesdeCoords({ latitude: 4, longitude: 4, timestamp: 4 }),
  ]
  assert.equal(loteListo(puntos.slice(0, 2)), false)
  const { lote, resto } = tomarLote(puntos)
  assert.equal(lote.length, 3)
  assert.equal(resto.length, 1)
  assert.equal(resto[0].latitud, 4)
})
