import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { NEUTROS } from '../src/themeTokens.ts'
import { colorPrimario } from '../src/lib/branding.ts'

test('neutros de campo: canvas frío, ink casi negro, 3 semánticos', () => {
  assert.equal(NEUTROS.canvas, '#FAFAF8')
  assert.notEqual(NEUTROS.canvas.toUpperCase(), '#F3EEE4')
  assert.equal(NEUTROS.ink, '#111111')
  assert.equal(NEUTROS.success, '#047857')
  assert.equal(NEUTROS.warn, '#B45309')
  assert.equal(NEUTROS.danger, '#B91C1C')
})

test('colorPrimario del tenant no altera los neutros', () => {
  assert.equal(colorPrimario({ color_primario: '#0F766E' }), '#0F766E')
  assert.equal(NEUTROS.canvas, '#FAFAF8')
})
