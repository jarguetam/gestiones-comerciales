import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { colorHexValido, colorPrimario, nombreComercial } from '../src/lib/branding.ts'

test('colorHexValido acepta hex de 3 o 6 dígitos', () => {
  assert.equal(colorHexValido('#0f766e'), '#0f766e')
  assert.equal(colorHexValido('#abc'), '#abc')
  assert.equal(colorHexValido('no-color'), null)
})

test('colorPrimario cae al default del producto', () => {
  assert.equal(colorPrimario({ color_primario: '#1D4ED8' }), '#1D4ED8')
  assert.equal(colorPrimario({}), '#1D4ED8')
})

test('nombreComercial usa branding o el fallback del tenant', () => {
  assert.equal(nombreComercial({ nombre_comercial: 'AgroMoney' }, 'Empresa'), 'AgroMoney')
  assert.equal(nombreComercial({}, 'Empresa S.A.'), 'Empresa S.A.')
})
