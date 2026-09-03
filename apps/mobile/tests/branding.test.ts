import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  colorHexValido,
  colorPrimario,
  logoUrlValido,
  nombreComercial,
  tintaSobrePrimario,
} from '../src/lib/branding.ts'

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

test('logoUrlValido solo acepta http(s)', () => {
  assert.equal(logoUrlValido('https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png')
  assert.equal(logoUrlValido('javascript:alert(1)'), null)
  assert.equal(logoUrlValido('https://user:pass@cdn.example.com/logo.png'), null)
  assert.equal(logoUrlValido(''), null)
})

test('tintaSobrePrimario aclara el primario para subtítulos', () => {
  const t = tintaSobrePrimario('#000000', 0.5)
  assert.match(t, /^rgb\(/)
  assert.equal(tintaSobrePrimario('no-hex'), 'rgba(255,255,255,0.8)')
})
