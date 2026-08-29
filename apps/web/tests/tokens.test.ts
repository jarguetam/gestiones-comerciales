import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { CANVAS_PROHIBIDO, FONTS_PROHIBIDOS, TOKENS } from '../src/theme/tokens.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('tokens de campo: canvas frío, ink casi negro, 3 semánticos', () => {
  assert.equal(TOKENS.canvas, '#FAFAF8')
  assert.notEqual(TOKENS.canvas.toUpperCase(), CANVAS_PROHIBIDO)
  assert.equal(TOKENS.ink, '#111111')
  assert.equal(TOKENS.ok, '#047857')
  assert.equal(TOKENS.warn, '#B45309')
  assert.equal(TOKENS.danger, '#B91C1C')
  assert.equal(TOKENS.railPx, 4)
  assert.equal(TOKENS.touchMinPx, 44)
  assert.equal(TOKENS.durationMs, 150)
})

test('CSS web publica los tokens de campo y no el crema rechazado', () => {
  const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
  assert.match(css, /--gc-canvas:\s*#fafaf8/i)
  assert.match(css, /--gc-ink:\s*#111111/i)
  assert.doesNotMatch(css, /#f3eee4/i)
  assert.match(css, /150ms/)
})

test('tailwind no carga Playfair ni pasteles de evento como marca', () => {
  const tw = readFileSync(join(root, 'tailwind.config.js'), 'utf8')
  for (const font of FONTS_PROHIBIDOS) {
    assert.doesNotMatch(tw, new RegExp(font.replace(/ /g, '\\s+')))
  }
  assert.doesNotMatch(tw, /fontFamily:\s*\{[^}]*serif:/)
  assert.match(tw, /Plus Jakarta Sans/)
  assert.doesNotMatch(tw, /amberBg|lavenderBg|mintBg/)
})

test('index.html no pide Playfair', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8')
  assert.doesNotMatch(html, /Playfair/)
  assert.match(html, /Plus\+Jakarta\+Sans/)
})
