import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crearGestorCanalInbox } from '../src/features/notificaciones/inboxRealtime.ts'

test('segundo attach no vuelve a llamar on ni subscribe', () => {
  let onCalls = 0
  let subscribeCalls = 0
  let removeCalls = 0
  const channel = {
    on() {
      onCalls += 1
      return channel
    },
    subscribe() {
      subscribeCalls += 1
      return channel
    },
  }
  const client = {
    channel() {
      return channel
    },
    removeChannel() {
      removeCalls += 1
      return Promise.resolve('ok')
    },
  }

  const gestor = crearGestorCanalInbox()
  const d1 = gestor.attach(client as never, () => {})
  const d2 = gestor.attach(client as never, () => {})
  assert.equal(onCalls, 1)
  assert.equal(subscribeCalls, 1)

  d1()
  assert.equal(removeCalls, 0)
  d2()
  assert.equal(removeCalls, 1)
})

test('re-attach tras detach total vuelve a suscribir', () => {
  let subscribeCalls = 0
  const channel = {
    on() {
      return channel
    },
    subscribe() {
      subscribeCalls += 1
      return channel
    },
  }
  const client = {
    channel() {
      return channel
    },
    removeChannel() {
      return Promise.resolve('ok')
    },
  }
  const gestor = crearGestorCanalInbox()
  const d1 = gestor.attach(client as never, () => {})
  d1()
  const d2 = gestor.attach(client as never, () => {})
  d2()
  assert.equal(subscribeCalls, 2)
})
