import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { brandingDeJson, colorCssValido, varsDeBranding, nombreComercial } from '../src/lib/branding.ts'

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

test('nombreComercial usa el branding y cae al tenant', () => {
  assert.equal(nombreComercial({ nombre_comercial: 'AgroMoney' }, 'Empresa'), 'AgroMoney')
  assert.equal(nombreComercial({}, 'Empresa S.A.'), 'Empresa S.A.')
})

test('brandingDeJson lee color y nombre del jsonb del tenant', () => {
  assert.deepEqual(brandingDeJson({ color_primario: '#0f766e', nombre_comercial: 'Agro' }), {
    nombre_comercial: 'Agro',
    color_primario: '#0f766e',
    logo_url: undefined,
  })
  assert.deepEqual(brandingDeJson(null), {})
  assert.deepEqual(brandingDeJson('x'), {})
})
