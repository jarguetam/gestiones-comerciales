/**
 * Un solo canal Realtime para el inbox de notificaciones.
 * Evita "cannot add postgres_changes callbacks … after subscribe()" cuando
 * AppShell y NotificacionesPage montan useNotificaciones a la vez.
 */

export type GestorCanalInbox = {
  // Cliente tipado laxo: overloads de RealtimeChannel no caben en un stub.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attach: (client: any, onChange: () => void) => () => void
}

const CHANNEL_NAME = 'inbox-notificacion'

export function crearGestorCanalInbox(): GestorCanalInbox {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let channel: any = null
  let refs = 0
  const listeners = new Set<() => void>()

  function notify() {
    for (const fn of listeners) fn()
  }

  return {
    attach(client, onChange) {
      listeners.add(onChange)
      if (!channel) {
        channel = client
          .channel(CHANNEL_NAME)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacion' }, () => {
            notify()
          })
        channel.subscribe()
      }
      refs += 1
      return () => {
        listeners.delete(onChange)
        refs -= 1
        if (refs <= 0 && channel) {
          const ch = channel
          channel = null
          refs = 0
          void client.removeChannel(ch)
        }
      }
    },
  }
}

/** Singleton de proceso (un tab = un canal). */
export const gestorCanalInbox = crearGestorCanalInbox()
