import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import {
  catalogoRecorrido,
  debeAutoiniciar,
  escaparHtml,
  marcarRecorridoVisto,
  resolverPasos,
  type ContextoRecorrido,
} from './recorrido'

interface Opciones extends ContextoRecorrido {
  usuarioId: string | undefined
  /** Color del tenant: el popover se monta en body, fuera del div con varsDeBranding. */
  colorPrimario: string | null
}

const RETRASO_AUTOINICIO_MS = 600

function almacenLocal(): Storage | null {
  try {
    return window.localStorage
  } catch (e) {
    console.warn('GC-RECORRIDO: localStorage bloqueado', e)
    return null
  }
}

function buscarVisible(selector: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if (el.getClientRects().length > 0) return el
  }
  return null
}

export function useRecorrido(opciones: Opciones) {
  const { pathname } = useLocation()
  const instancia = useRef<Driver | null>(null)
  const montado = useRef(true)
  const ultimas = useRef(opciones)
  ultimas.current = opciones

  const iniciar = useCallback(async () => {
    if (instancia.current?.isActive()) return
    const { driver } = await import('driver.js')
    if (!montado.current) return
    const o = ultimas.current
    const pasos = resolverPasos(catalogoRecorrido(o), buscarVisible)
    const d = driver({
      steps: pasos.map((p) => ({
        element: p.elemento,
        popover: {
          title: escaparHtml(p.titulo),
          description: escaparHtml(p.descripcion),
          side: p.lado,
        },
      })),
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Listo',
      closeBtnLabel: 'Cerrar recorrido',
      popoverClass: 'gc-recorrido',
      disableActiveInteraction: true,
      overlayOpacity: 0.55,
      stagePadding: 4,
      stageRadius: 8,
      onPopoverRender: (popover) => {
        if (o.colorPrimario) popover.wrapper.style.setProperty('--gc-primary', o.colorPrimario)
      },
      onDestroyed: () => {
        marcarRecorridoVisto(almacenLocal(), o.usuarioId)
        instancia.current = null
      },
    })
    instancia.current = d
    d.drive()
  }, [])

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      instancia.current?.destroy()
    }
  }, [])

  // Los pasos señalan el shell; si cambia la pantalla por detrás, el recorrido ya no corresponde.
  useEffect(() => {
    instancia.current?.destroy()
  }, [pathname])

  const { usuarioId } = opciones
  useEffect(() => {
    const autoiniciar = debeAutoiniciar({
      almacen: almacenLocal(),
      usuarioId,
      ruta: pathname,
      automatizado: navigator.webdriver === true,
    })
    if (!autoiniciar) return
    const t = window.setTimeout(() => void iniciar(), RETRASO_AUTOINICIO_MS)
    return () => window.clearTimeout(t)
  }, [usuarioId, pathname, iniciar])

  return { iniciar }
}
