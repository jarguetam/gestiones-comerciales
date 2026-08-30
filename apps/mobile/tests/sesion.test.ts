import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Session } from '@supabase/supabase-js'
import { reducirSesion, suscribirSesion, type AuthSuscribible } from '../src/lib/sesion.ts'

function sesionFake(id: string): Session {
  return { access_token: `tok-${id}`, user: { id } } as Session
}

test('SIGNED_IN hidrata sesión y SIGNED_OUT la borra', () => {
  let estado = { session: null as Session | null }
  estado = reducirSesion(estado, 'SIGNED_IN', sesionFake('a'))
  assert.equal(estado.session?.user.id, 'a')
  estado = reducirSesion(estado, 'TOKEN_REFRESHED', sesionFake('a'))
  assert.equal(estado.session?.access_token, 'tok-a')
  estado = reducirSesion(estado, 'SIGNED_OUT', null)
  assert.equal(estado.session, null)
})

test('suscribirSesion propaga SIGNED_IN y SIGNED_OUT al callback', () => {
  const listeners: Array<(event: string, session: Session | null) => void> = []
  const cliente: AuthSuscribible = {
    auth: {
      onAuthStateChange(cb) {
        listeners.push(cb)
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  }
  const vistos: string[] = []
  suscribirSesion(cliente, (estado, event) => {
    vistos.push(`${event}:${estado.session ? estado.session.user.id : 'null'}`)
  })
  listeners[0]('SIGNED_IN', sesionFake('u1'))
  listeners[0]('SIGNED_OUT', null)
  assert.deepEqual(vistos, ['SIGNED_IN:u1', 'SIGNED_OUT:null'])
})
