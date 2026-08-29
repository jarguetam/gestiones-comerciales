import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  titulo: string
  descripcion?: string
  tone: ToastTone
}

interface ToastApi {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id'> & { id?: string }) => void
  dismiss: (id: string) => void
}

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (t: Omit<ToastItem, 'id'> & { id?: string }) => {
      const id = t.id ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((prev) => [...prev, { ...t, id }])
      window.setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 p-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto rounded-xl border px-4 py-3 shadow-lg bg-surface',
              t.tone === 'error' && 'border-red-200',
              t.tone === 'success' && 'border-emerald-200',
              t.tone === 'info' && 'border-line',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{t.titulo}</p>
                {t.descripcion ? <p className="mt-0.5 text-xs text-muted">{t.descripcion}</p> : null}
              </div>
              <button type="button" className="text-muted text-sm" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
