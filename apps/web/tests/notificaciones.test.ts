import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  contarNoLeidas,
  marcarLeida,
  demoNotificaciones,
} from '../src/features/notificaciones/notificaciones.ts'

test('contarNoLeidas ignora las ya leídas', () => {
  const items = demoNotificaciones()
  assert.ok(contarNoLeidas(items) >= 1)
  assert.ok(contarNoLeidas(items) < items.length)
  assert.equal(contarNoLeidas(items.filter((n) => n.leida)), 0)
})

test('marcarLeida solo toca el id indicado', () => {
  const items = demoNotificaciones()
  const target = items.find((n) => !n.leida)
  assert.ok(target)
  const next = marcarLeida(items, target.id)
  assert.equal(next.find((n) => n.id === target.id)?.leida, true)
  assert.equal(
    next.filter((n) => n.id !== target.id && !n.leida).length,
    items.filter((n) => n.id !== target.id && !n.leida).length,
  )
})
