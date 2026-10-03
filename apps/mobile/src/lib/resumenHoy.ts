/** M-02: reglas de las tarjetas resumen de Hoy. Sin React para testear con node:test. */

export type TarjetaId = 'visitas' | 'leads' | 'solicitudes' | 'depositos' | 'sync'

export type ValorTarjeta =
  | { estado: 'cargando' }
  | { estado: 'ok'; valor: number }
  | { estado: 'sin_conexion' }
  | { estado: 'error'; codigo: string }

const MODULO: Partial<Record<TarjetaId, string>> = {
  leads: 'crm',
  solicitudes: 'solicitudes',
  depositos: 'depositos',
}

const ORDEN: TarjetaId[] = ['visitas', 'leads', 'solicitudes', 'depositos', 'sync']

export function tarjetasVisibles(modulos: string[]): TarjetaId[] {
  return ORDEN.filter((id) => {
    const modulo = MODULO[id]
    return !modulo || modulos.includes(modulo)
  })
}

const ERROR_RED = /Network request failed|Failed to fetch|fetch failed|Network Error/i
const CODIGO_GC = /\bGC-[A-Z]+-\d{3}\b/

export function esErrorDeRed(mensaje: string): boolean {
  return ERROR_RED.test(mensaje)
}

/** Sin código de negocio, un fallo de lectura es GC-CORE-001 (no se pudo hablar con el backend). */
export function valorDeConteo(res: { count: number | null; error: { message: string } | null }): ValorTarjeta {
  if (res.error) {
    if (esErrorDeRed(res.error.message)) return { estado: 'sin_conexion' }
    return { estado: 'error', codigo: res.error.message.match(CODIGO_GC)?.[0] ?? 'GC-CORE-001' }
  }
  if (typeof res.count !== 'number') return { estado: 'error', codigo: 'GC-CORE-001' }
  return { estado: 'ok', valor: res.count }
}

export function textoValor(v: ValorTarjeta): string {
  if (v.estado === 'ok') return String(v.valor)
  if (v.estado === 'cargando') return '…'
  return '—'
}

export function textoEstado(v: ValorTarjeta, contexto: string): string {
  if (v.estado === 'sin_conexion') return 'Sin conexión'
  if (v.estado === 'error') return `No se pudo leer (${v.codigo})`
  return contexto
}

/** Medianoche local en ISO UTC, para filtrar `creado_en` por «hoy» del asesor. */
export function inicioDiaLocalISO(ahora: Date): string {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString()
}
