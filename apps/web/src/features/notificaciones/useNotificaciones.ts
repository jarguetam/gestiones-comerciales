import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { QK } from '../../lib/queryClient'
import { contarNoLeidas, marcarLeida, type ItemNotificacion } from './notificaciones'
import { fetchNotificaciones, persistirLeida } from './notificacionesApi'

export function useNotificaciones(live: boolean) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: QK.notificaciones,
    queryFn: fetchNotificaciones,
    enabled: true,
  })

  useEffect(() => {
    if (!live) return
    const ch = supabase
      .channel('inbox-notificacion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacion' }, () => {
        void qc.invalidateQueries({ queryKey: QK.notificaciones })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [live, qc])

  const leer = useMutation({
    mutationFn: async (id: string) => {
      await persistirLeida(id)
      return id
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK.notificaciones })
      const prev = qc.getQueryData<ItemNotificacion[]>(QK.notificaciones)
      qc.setQueryData<ItemNotificacion[]>(QK.notificaciones, (cur) => marcarLeida(cur ?? [], id))
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.notificaciones, ctx.prev)
    },
  })

  const items = query.data ?? []
  return {
    items,
    pendientes: contarNoLeidas(items),
    cargando: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    leer: (id: string) => leer.mutate(id),
    refetch: () => query.refetch(),
  }
}
