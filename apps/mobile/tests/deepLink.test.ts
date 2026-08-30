import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { esRecuperarPassword, parseDeepLink } from '../src/lib/deepLink.ts'

test('parseDeepLink visita y solicitud', () => {
  assert.deepEqual(parseDeepLink('gestiones://visita/104'), { tab: 'agenda', id: '104' })
  assert.deepEqual(parseDeepLink('gc://visita/104'), { tab: 'agenda', id: '104' })
  assert.deepEqual(parseDeepLink('gestiones://solicitud/7'), { tab: 'solicitudes', id: '7' })
  assert.deepEqual(parseDeepLink('gestiones://acme/visita/9'), { tab: 'agenda', id: '9' })
  assert.equal(parseDeepLink('https://example.com'), null)
  assert.equal(parseDeepLink(null), null)
})

test('esRecuperarPassword reconoce gc://recuperar', () => {
  assert.equal(esRecuperarPassword('gc://recuperar'), true)
  assert.equal(esRecuperarPassword('gestiones://recuperar'), true)
  assert.equal(esRecuperarPassword('gc://visita/1'), false)
})
