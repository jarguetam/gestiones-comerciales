import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const preview = readFileSync(new URL('../../../.github/workflows/eas-preview.yml', import.meta.url), 'utf8')
const internal = readFileSync(new URL('../../../.github/workflows/eas-internal.yml', import.meta.url), 'utf8')

test('workflows EAS no hacen submit iOS', () => {
  assert.equal(preview.includes('eas submit --platform ios'), false)
  assert.equal(internal.includes('eas submit --platform ios'), false)
  assert.equal(/--platform\s+ios/.test(internal), false)
  assert.match(internal, /eas submit --platform android/)
  assert.match(preview, /--platform android --profile preview/)
  assert.match(internal, /--platform android --profile production/)
})

test('workflows EAS usan environment eas-android', () => {
  assert.match(preview, /environment:\s*eas-android/)
  assert.match(internal, /environment:\s*eas-android/)
})
