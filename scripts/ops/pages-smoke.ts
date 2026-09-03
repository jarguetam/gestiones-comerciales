export type PagesSmokeResult = { ok: boolean; detail: string }

export function evaluatePagesHtml(html: string): PagesSmokeResult {
  if (!html.includes('Ingresar')) {
    return { ok: false, detail: 'GC-OPS-009: login form no visible (falta Ingresar)' }
  }
  if (html.includes('Entrar al tablero')) {
    return { ok: false, detail: 'GC-OPS-009: HTML contiene Entrar al tablero' }
  }
  if (html.includes('Backend conectado')) {
    return { ok: false, detail: 'GC-OPS-009: HTML contiene copy de demo' }
  }
  return { ok: true, detail: 'ok' }
}

export function edgeSmokeOk(status: number): boolean {
  return status === 401 || status === 400
}
