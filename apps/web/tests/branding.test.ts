import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  brandingDeJson,
  colorCssValido,
  varsDeBranding,
  nombreComercial,
  logoUrlValido,
  monograma,
  tintaSobrePrimario,
} from '../src/lib/branding.ts'

test('colorCssValido acepta hex de 3 o 6 dígitos', () => {
  assert.equal(colorCssValido('#0f766e'), '#0f766e')
  assert.equal(colorCssValido('#abc'), '#abc')
  assert.equal(colorCssValido('no-color'), null)
  assert.equal(colorCssValido(''), null)
  assert.equal(colorCssValido(undefined), null)
})

test('varsDeBranding expone --gc-primary solo con color válido', () => {
  assert.deepEqual(varsDeBranding({ color_primario: '#1D4ED8' }), { '--gc-primary': '#1D4ED8' })
  assert.deepEqual(varsDeBranding({}), {})
})

test('varsDeBranding incluye secundario opcional', () => {
  assert.deepEqual(varsDeBranding({ color_primario: '#1D4ED8', color_secundario: '#F59E0B' }), {
    '--gc-primary': '#1D4ED8',
    '--gc-secondary': '#F59E0B',
  })
})

test('nombreComercial usa el branding y cae al tenant', () => {
  assert.equal(nombreComercial({ nombre_comercial: 'AgroMoney' }, 'Empresa'), 'AgroMoney')
  assert.equal(nombreComercial({}, 'Empresa S.A.'), 'Empresa S.A.')
})

test('brandingDeJson lee color, nombre y logo del jsonb del tenant', () => {
  assert.deepEqual(brandingDeJson({ color_primario: '#0f766e', nombre_comercial: 'Agro', logo_url: 'https://cdn.ejemplo/logo.png' }), {
    nombre_comercial: 'Agro',
    color_primario: '#0f766e',
    color_secundario: undefined,
    logo_url: 'https://cdn.ejemplo/logo.png',
    vocabulario: undefined,
  })
  assert.deepEqual(brandingDeJson(null), {})
  assert.deepEqual(brandingDeJson('x'), {})
})

test('logoUrlValido solo acepta http(s) reconstruido, sin credenciales', () => {
  assert.equal(logoUrlValido('https://cdn.ejemplo/a.png'), 'https://cdn.ejemplo/a.png')
  assert.equal(logoUrlValido('  https://cdn.ejemplo/a.png  '), 'https://cdn.ejemplo/a.png')
  assert.equal(logoUrlValido('javascript:alert(1)'), null)
  assert.equal(logoUrlValido('data:text/html,<script>alert(1)</script>'), null)
  assert.equal(logoUrlValido('https://user:pass@cdn.ejemplo/a.png'), null)
  assert.equal(logoUrlValido('/local.svg'), null)
  assert.equal(logoUrlValido(''), null)
})

test('monograma usa iniciales del nombre comercial', () => {
  assert.equal(monograma('AgroMoney S.A.'), 'AS')
  assert.equal(monograma('Acme'), 'AC')
  assert.equal(monograma('  '), 'GC')
})

test('tintaSobrePrimario aclara el primario (no usa azul fijo)', () => {
  const sobreRojo = tintaSobrePrimario('#991B1B')
  assert.notEqual(sobreRojo.toLowerCase(), '#bfdbfe')
  assert.match(sobreRojo, /^#|rgb/i)
})
