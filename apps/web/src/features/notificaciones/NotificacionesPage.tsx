import { useCallback, useEffect, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import {
  contarNoLeidas,
  demoNotificaciones,
  marcarLeida,
  type ItemNotificacion,
} from './notificaciones'
import { Alert, Button, EmptyState, PageHeader } from '../../components/ui'
import { cn } from '../../lib/cn'

export function NotificacionesPage() {
  const { fuente } = useDominio()
  const live = !DEMO_MODE && fuente === 'supabase'
  const [items, setItems] = useState<ItemNotificacion[]>(demoNotificaciones())
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!live) {
      setItems(demoNotificaciones())
      return
    }
    const { data, error } = await supabase
      .from('notificacion')
      .select('id, titulo, cuerpo, leida, creado_en')
      .order('creado_en', { ascending: false })
      .limit(100)
    if (error) {
      setError(error.message)
      return
    }
    setItems(
      ((data ?? []) as Array<Record<string, unknown>>).map((n) => ({
        id: String(n.id),
        titulo: String(n.titulo),
        cuerpo: String(n.cuerpo),
        leida: Boolean(n.leida),
        creado_en: String(n.creado_en),
      })),
    )
  }, [live])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function leer(id: string) {
    setItems((prev) => marcarLeida(prev, id))
    if (!live) return
    const { error } = await supabase.from('notificacion').update({ leida: true }).eq('id', id)
    if (error) setError(error.message)
  }

  const pendientes = contarNoLeidas(items)

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <PageHeader spec="W-13" title="Notificaciones" description={`Centro in-app · ${pendientes} sin leer`} />
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {items.length === 0 ? (
        <EmptyState titulo="No hay notificaciones" descripcion="Cuando haya avisos de visitas o asignaciones aparecen aquí." />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={cn(
                'rounded-2xl border p-4',
                n.leida ? 'border-line bg-surface' : 'border-primary/30 bg-canvas',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{n.titulo}</h3>
                  <p className="text-sm text-muted mt-1">{n.cuerpo}</p>
                  <p className="text-[11px] text-muted mt-2">{new Date(n.creado_en).toLocaleString()}</p>
                </div>
                {!n.leida && (
                  <Button variant="ghost" size="sm" onClick={() => void leer(n.id)}>
                    Marcar leída
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
