import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  contarNoLeidas,
  demoNotificaciones,
  deepLinkDe,
  marcarLeida,
} from '../src/lib/notificaciones.ts'

test('contarNoLeidas ignora las ya leídas', () => {
  const items = demoNotificaciones()
  assert.ok(contarNoLeidas(items) >= 1)
  assert.ok(contarNoLeidas(items) < items.length)
})

test('marcarLeida solo toca el id indicado', () => {
  const items = demoNotificaciones()
  const target = items.find((n) => !n.leida)
  assert.ok(target)
  const next = marcarLeida(items, target.id)
  assert.equal(next.find((n) => n.id === target.id)?.leida, true)
})

test('deepLinkDe arma gestiones:// hacia visita o solicitud', () => {
  assert.equal(deepLinkDe({ visita_id: 42 }), 'gestiones://visita/42')
  assert.equal(deepLinkDe({ solicitud_id: 7 }), 'gestiones://solicitud/7')
  assert.equal(deepLinkDe({}), null)
  assert.equal(deepLinkDe(undefined), null)
})
