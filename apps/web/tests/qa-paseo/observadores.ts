import type { Page, Response } from '@playwright/test'
import type { Recolector } from './hallazgos.ts'

/** Ruido de entorno / CSP / assets; no son bugs de pantalla. */
const CONSOLE_IGNORE = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon\.ico/i,
  /Content Security Policy/i,
  /frame-ancestors/i,
  /fonts\.googleapis\.com/i,
  /Failed to load resource/i,
  /net::ERR_/i,
]

export type DetachObs = () => void

/** Adjunta listeners de consola y red; los hallazgos van al recolector. */
export function observarPagina(page: Page, ruta: string, rec: Recolector): DetachObs {
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (CONSOLE_IGNORE.some((re) => re.test(text))) return
    rec.add({ tipo: 'console', severidad: 'high', ruta, mensaje: text.slice(0, 500) })
  }

  const onPageError = (err: Error) => {
    rec.add({
      tipo: 'crash',
      severidad: 'critical',
      ruta,
      mensaje: err.message.slice(0, 500),
    })
  }

  const onResponse = (res: Response) => {
    const status = res.status()
    if (status < 400) return
    if (status === 401 || status === 403) return
    // Placeholders CI / auth challenge → no alertar 4xx de supabase
    const url = res.url()
    if (/supabase\.co/i.test(url) && status < 500) return
    rec.add({
      tipo: 'network',
      severidad: status >= 500 ? 'high' : 'medium',
      ruta,
      mensaje: `${status} ${res.request().method()}`,
      evidencia: url.slice(0, 300),
    })
  }

  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('response', onResponse)

  return () => {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('response', onResponse)
  }
}
