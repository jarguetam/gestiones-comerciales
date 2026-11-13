/** Carga desde el servidor y, sin señal, recurre a la última copia guardada en el teléfono. */
import { esErrorTransitorio } from './errorRed.ts'
import type { Guardado } from './cacheCampo.ts'
import { mensajeDeError } from './mensajeError.ts'

export interface ResultadoRespaldo<T> {
  datos: T
  origen: 'servidor' | 'cache'
  guardadoEn?: string
}

/** El error de la caché es el que se ve; la falla de red original queda como causa. */
function conCausa(err: unknown, causa: unknown): Error {
  if (err instanceof Error && err.cause === undefined) {
    err.cause = causa
    return err
  }
  return new Error(mensajeDeError(err, 'GC-CACHE-002: no se pudo leer la copia local'), { cause: causa })
}

export async function conRespaldo<T>(opts: {
  cargar: () => Promise<T>
  leer: () => Promise<Guardado<T> | null>
  guardar: (datos: T) => Promise<void>
  advertir?: (mensaje: string, detalle: unknown) => void
}): Promise<ResultadoRespaldo<T>> {
  let datos: T
  try {
    datos = await opts.cargar()
  } catch (err) {
    if (!esErrorTransitorio(err)) throw err
    let guardado: Guardado<T> | null
    try {
      guardado = await opts.leer()
    } catch (errLeer) {
      throw conCausa(errLeer, err)
    }
    if (!guardado) throw new Error('GC-NET-002: sin conexión y sin datos guardados', { cause: err })
    return { datos: guardado.datos, origen: 'cache', guardadoEn: guardado.guardadoEn }
  }
  try {
    await opts.guardar(datos)
  } catch (errGuardar) {
    // Los datos del servidor valen aunque no se pueda guardar la copia: no se descartan
    // (si el perfil fallara aquí, App volvería al login: GC-AUTH-024).
    const advertir = opts.advertir ?? ((m: string, d: unknown) => console.warn(m, d))
    advertir('GC-CACHE-001: no se pudo guardar la copia local', errGuardar)
  }
  return { datos, origen: 'servidor' }
}
