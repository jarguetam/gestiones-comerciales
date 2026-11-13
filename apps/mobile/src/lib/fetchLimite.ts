/** fetch con tiempo máximo: con señal débil una petición colgada no debe bloquear la cola. */

export function fetchConLimite(ms: number, base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const control = new AbortController()
    const externa = init?.signal
    const alAbortarExterna = () => control.abort(externa?.reason)
    if (externa) {
      if (externa.aborted) control.abort(externa.reason)
      else externa.addEventListener('abort', alAbortarExterna, { once: true })
    }
    const temporizador = setTimeout(() => control.abort(new Error('GC-NET-003: timeout de red')), ms)
    return base(input, { ...init, signal: control.signal }).finally(() => {
      clearTimeout(temporizador)
      externa?.removeEventListener('abort', alAbortarExterna)
    })
  }
}
