import { useEffect, useRef } from 'react'
import { cancelStroke, endStroke, startStroke, type FirmaStroke } from '../../lib/firmaStroke'

/** Lienzo mínimo de firma (PNG). W-06. */
export function FirmaCanvas({
  onChange,
  disabled,
}: {
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const stroke = useRef<FirmaStroke>({ activo: false })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    }
  }

  function emit() {
    const c = ref.current
    if (!c) return
    onChange(c.toDataURL('image/png'))
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    startStroke(stroke.current)
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!stroke.current.activo || disabled) return
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function up() {
    if (!stroke.current.activo) return
    endStroke(stroke.current)
    emit()
  }

  function cancel() {
    if (!stroke.current.activo) return
    cancelStroke(stroke.current)
  }

  function limpiar() {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, c.width, c.height)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={ref}
        width={480}
        height={160}
        className="w-full rounded-lg border border-line bg-surface touch-none"
        aria-label="Lienzo de firma"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={cancel}
      />
      <button type="button" className="mt-2 text-xs text-muted underline" onClick={limpiar} disabled={disabled}>
        Limpiar firma
      </button>
    </div>
  )
}
