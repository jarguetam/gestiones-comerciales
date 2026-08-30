import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { mostrarMapa } from '../src/lib/claims.ts'
import { colorDeToken } from '../src/lib/mapaTokens.ts'
import {
  boundsDe,
  coordenadasDe,
  filtrarEquipo,
  recorridoDe,
  ultimaPorAsesor,
  type PuntoMapa,
} from '../src/lib/mapa.ts'

function punto(parcial: Partial<PuntoMapa> & Pick<PuntoMapa, 'usuarioId' | 'lat' | 'lng' | 'registradoEn'>): PuntoMapa {
  return {
    nombre: parcial.nombre ?? 'Asesor',
    rol: parcial.rol ?? 'asesor',
    jefeId: parcial.jefeId ?? null,
    precisionM: parcial.precisionM,
    ...parcial,
  }
}

test('mostrarMapa: supervisor, gerente y admin; no el asesor', () => {
  assert.equal(mostrarMapa('admin'), true)
  assert.equal(mostrarMapa('gerente'), true)
  assert.equal(mostrarMapa('supervisor'), true)
  assert.equal(mostrarMapa('asesor'), false)
  assert.equal(mostrarMapa(undefined), false)
})

test('coordenadasDe lee GeoJSON Point [lng, lat]', () => {
  const c = coordenadasDe({ type: 'Point', coordinates: [-90.513, 14.634] })
  assert.ok(c)
  assert.equal(c.lng, -90.513)
  assert.equal(c.lat, 14.634)
})

test('coordenadasDe lee WKT POINT', () => {
  const c = coordenadasDe('POINT(-91.518 14.834)')
  assert.ok(c)
  assert.equal(c.lng, -91.518)
  assert.equal(c.lat, 14.834)
})

test('coordenadasDe rechaza geometría inválida', () => {
  assert.equal(coordenadasDe(null), null)
  assert.equal(coordenadasDe({ type: 'LineString', coordinates: [] }), null)
  assert.equal(coordenadasDe('POLYGON((0 0,1 1))'), null)
})

test('ultimaPorAsesor toma el punto más reciente por usuario', () => {
  const ultimas = ultimaPorAsesor([
    punto({ usuarioId: 'a', lat: 14.6, lng: -90.5, registradoEn: '2026-08-28T12:00:00.000Z', nombre: 'Luisa' }),
    punto({ usuarioId: 'a', lat: 14.7, lng: -90.6, registradoEn: '2026-08-28T15:00:00.000Z', nombre: 'Luisa' }),
    punto({ usuarioId: 'b', lat: 14.8, lng: -91.5, registradoEn: '2026-08-28T13:00:00.000Z', nombre: 'Carlos' }),
  ])
  assert.equal(ultimas.length, 2)
  const luisa = ultimas.find((p) => p.usuarioId === 'a')
  assert.equal(luisa?.lat, 14.7)
  assert.equal(luisa?.lng, -90.6)
})

test('recorridoDe ordena cronológicamente el día de un asesor', () => {
  const rec = recorridoDe(
    [
      punto({ usuarioId: 'a', lat: 14.7, lng: -90.6, registradoEn: '2026-08-28T15:00:00.000Z' }),
      punto({ usuarioId: 'a', lat: 14.6, lng: -90.5, registradoEn: '2026-08-28T12:00:00.000Z' }),
      punto({ usuarioId: 'b', lat: 1, lng: 1, registradoEn: '2026-08-28T12:00:00.000Z' }),
    ],
    'a',
  )
  assert.equal(rec.length, 2)
  assert.equal(rec[0].lat, 14.6)
  assert.equal(rec[1].lat, 14.7)
})

test('filtrarEquipo deja al supervisor y a sus asesores', () => {
  const puntos = [
    punto({ usuarioId: 'sup', jefeId: 'ger', rol: 'supervisor', lat: 14, lng: -90, registradoEn: '2026-08-28T12:00:00.000Z' }),
    punto({ usuarioId: 'a1', jefeId: 'sup', lat: 14.1, lng: -90.1, registradoEn: '2026-08-28T12:00:00.000Z' }),
    punto({ usuarioId: 'a2', jefeId: 'otro', lat: 14.2, lng: -90.2, registradoEn: '2026-08-28T12:00:00.000Z' }),
  ]
  const equipo = filtrarEquipo(puntos, 'sup')
  assert.deepEqual(equipo.map((p) => p.usuarioId).sort(), ['a1', 'sup'])
})

test('boundsDe cubre todos los puntos', () => {
  const b = boundsDe([
    punto({ usuarioId: 'a', lat: 14.0, lng: -91.0, registradoEn: '2026-08-28T12:00:00.000Z' }),
    punto({ usuarioId: 'b', lat: 15.0, lng: -90.0, registradoEn: '2026-08-28T12:00:00.000Z' }),
  ])
  assert.ok(b)
  assert.equal(b.sur, 14)
  assert.equal(b.norte, 15)
  assert.equal(b.oeste, -91)
  assert.equal(b.este, -90)
})

test('colorDeToken cae a ink si no hay DOM', () => {
  assert.equal(colorDeToken('--gc-primary'), '#111111')
  assert.equal(colorDeToken('--gc-warn'), '#B45309')
})

test('MapaLeaflet no pinta hex de marca; usa tokens', () => {
  const src = readFileSync(new URL('../src/features/mapa/MapaLeaflet.tsx', import.meta.url), 'utf8')
  assert.match(src, /colorDeToken\('--gc-primary'\)/)
  assert.equal(src.includes('#6D28D9'), false)
  assert.equal(src.includes('#7C3AED'), false)
})
