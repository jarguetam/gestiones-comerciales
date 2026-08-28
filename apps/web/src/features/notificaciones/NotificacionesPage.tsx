import { useCallback, useEffect, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import {
  contarNoLeidas,
  demoNotificaciones,
  marcarLeida,
  type ItemNotificacion,
} from './notificaciones'

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
    <div className="max-w-xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-13</p>
        <h2 className="font-serif text-3xl">Notificaciones</h2>
        <p className="text-sm text-slate-600">
          Centro in-app · {pendientes} sin leer
        </p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <ul className="space-y-3">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border p-4 ${n.leida ? 'border-slate-100 bg-white' : 'border-purple-100 bg-purple-50/40'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{n.titulo}</h3>
                <p className="text-sm text-slate-600 mt-1">{n.cuerpo}</p>
                <p className="text-[11px] text-slate-400 mt-2">{new Date(n.creado_en).toLocaleString()}</p>
              </div>
              {!n.leida && (
                <button
                  type="button"
                  onClick={() => void leer(n.id)}
                  className="shrink-0 text-xs font-semibold text-brand-700"
                >
                  Marcar leída
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
