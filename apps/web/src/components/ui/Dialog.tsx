import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Dialog({
  title,
  onClose,
  children,
  className,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const root = ref.current
    const first = root?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !root) return
      const nodos = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => !n.hasAttribute('disabled'))
      if (nodos.length === 0) return
      const i = nodos.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey) {
        if (i <= 0) {
          e.preventDefault()
          nodos[nodos.length - 1].focus()
        }
      } else if (i === nodos.length - 1) {
        e.preventDefault()
        nodos[0].focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-surface shadow-2xl', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-primary px-6 py-4 text-white">
          <h2 id={titleId} className="font-serif text-lg tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
