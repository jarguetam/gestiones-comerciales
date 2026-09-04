import assert from 'node:assert/strict'
import test from 'node:test'
import {
  nombreCanalInbox,
  suscribirInboxNotificacion,
} from '../src/features/notificaciones/inboxRealtime.ts'

test('nombreCanalInbox es único por instancia (H1)', () => {
  const a = nombreCanalInbox('a')
  const b = nombreCanalInbox('b')
  assert.notEqual(a, b)
  assert.match(a, /^inbox-notificacion:/)
  assert.match(b, /^inbox-notificacion:/)
})

test('dos suscripciones no reutilizan el canal ya subscribed', () => {
  const subscribed = new Set<string>()
  const onsAfterSubscribe: string[] = []

  function crearCliente() {
    return {
      channel(nombre: string) {
        const ch = {
          name: nombre,
          subscribed: false,
          on() {
            if (this.subscribed || subscribed.has(nombre)) {
              onsAfterSubscribe.push(nombre)
              throw new Error(
                `cannot add postgres_changes callbacks for realtime:${nombre} after subscribe()`,
              )
            }
            return this
          },
          subscribe() {
            this.subscribed = true
            subscribed.add(nombre)
            return this
          },
        }
        if (subscribed.has(nombre)) {
          ch.subscribed = true
        }
        return ch
      },
      removeChannel() {},
    }
  }

  const client = crearCliente()
  const off1 = suscribirInboxNotificacion(client, () => {})
  const off2 = suscribirInboxNotificacion(client, () => {})
  assert.equal(onsAfterSubscribe.length, 0)
  assert.equal(subscribed.size, 2)
  off1()
  off2()
})
