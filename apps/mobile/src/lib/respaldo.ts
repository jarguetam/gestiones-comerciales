/** Carga desde el servidor y, sin señal, recurre a la última copia guardada en el teléfono. */
import { esErrorTransitorio } from './errorRed.ts'
import type { Guardado } from './cacheCampo.ts'

export interface ResultadoRespaldo<T> {
  datos: T
  origen: 'servidor' | 'cache'
  guardadoEn?: string
}

export async function conRespaldo<T>(opts: {
  cargar: () => Promise<T>
  leer: () => Promise<Guardado<T> | null>
  guardar: (datos: T) => Promise<void>
}): Promise<ResultadoRespaldo<T>> {
  let datos: T
  try {
    datos = await opts.cargar()
  } catch (err) {
    if (!esErrorTransitorio(err)) throw err
    const guardado = await opts.leer()
    if (!guardado) throw new Error('GC-NET-002: sin conexión y sin datos guardados', { cause: err })
    return { datos: guardado.datos, origen: 'cache', guardadoEn: guardado.guardadoEn }
  }
  await opts.guardar(datos)
  return { datos, origen: 'servidor' }
}
