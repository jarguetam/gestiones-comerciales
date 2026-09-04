/** Canal realtime del inbox. Un nombre por instancia: supabase reusa el topic si se llama `.channel(mismo)` ya subscribed. */

import type { SupabaseClient } from '@supabase/supabase-js'

export type InboxRealtimeClient = Pick<SupabaseClient, 'channel' | 'removeChannel'>

let seq = 0

export function nombreCanalInbox(instancia: string | number): string {
  return `inbox-notificacion:${instancia}`
}

export function siguienteNombreCanalInbox(): string {
  seq += 1
  return nombreCanalInbox(seq)
}

export function suscribirInboxNotificacion(client: InboxRealtimeClient, onChange: () => void): () => void {
  const ch = client
    .channel(siguienteNombreCanalInbox())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacion' }, onChange)
    .subscribe()
  return () => {
    void client.removeChannel(ch)
  }
}
