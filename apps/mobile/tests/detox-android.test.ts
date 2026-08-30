import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const detox = readFileSync(new URL('../.detoxrc.js', import.meta.url), 'utf8')
const wf = readFileSync(new URL('../../../.github/workflows/detox-android.yml', import.meta.url), 'utf8')

test('Detox es Android API 34 y no declara iOS', () => {
  assert.match(detox, /android\.emulator/)
  assert.match(detox, /Pixel_API_34/)
  assert.equal(/ios\./.test(detox), false)
  assert.match(wf, /workflow_dispatch/)
})
