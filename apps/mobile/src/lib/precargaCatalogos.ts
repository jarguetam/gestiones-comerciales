/**
 * Precarga de catálogos de campo en segundo plano: al entrar, al volver la app al frente y,
 * mientras la última descarga no haya llegado al servidor (sin señal, sin sesión o con error),
 * en cada vuelta del temporizador, para que vuelva a intentar en cuanto haya señal. Así el
 * asesor puede agendar sin señal aunque nunca haya abierto «Agendar» con señal.
 * Nunca bloquea la pantalla ni rechaza: los fallos se avisan con GC-CAT-001.
 */
import type { CacheCampo } from './cacheCampo.ts'

/** Con una copia del servidor más reciente que esto no se vuelve a descargar. */
export const REFRESCO_CATALOGOS_MS = 30 * 60_000

export interface PrecargaCatalogos {
  siHaceFalta: () => Promise<void>
}

export function crearPrecargaCatalogos(opts: {
  cargar: () => Promise<{ origen: 'servidor' | 'cache' }>
  advertir?: (mensaje: string, detalle: unknown) => void
  ahora?: () => number
}): PrecargaCatalogos {
  const ahora = opts.ahora ?? Date.now
  const advertir = opts.advertir ?? ((m: string, d: unknown) => console.warn(m, d))
  let enCurso: Promise<void> | null = null
  let ultimaDelServidor: number | null = null

  function descargar(): Promise<void> {
    if (enCurso) return enCurso
    enCurso = (async () => {
      try {
        const r = await opts.cargar()
        if (r.origen === 'servidor') ultimaDelServidor = ahora()
      } catch (err) {
        advertir('GC-CAT-001: no se pudieron precargar los catálogos', err)
      }
    })().finally(() => {
      enCurso = null
    })
    return enCurso
  }

  return {
    siHaceFalta() {
      if (ultimaDelServidor !== null && ahora() - ultimaDelServidor < REFRESCO_CATALOGOS_MS) {
        return Promise.resolve()
      }
      return descargar()
    },
  }
}

/** La misma caché, pero solo escribe mientras `permitido()`: una descarga tardía no repone lo que el logout borró. */
export function cacheConGuardadoSi(cache: CacheCampo, permitido: () => boolean): CacheCampo {
  return {
    leer: (clave, tipo) => cache.leer(clave, tipo),
    guardar: (clave, tipo, datos, cuando) =>
      permitido() ? cache.guardar(clave, tipo, datos, cuando) : Promise.resolve(),
    limpiar: (clave) => cache.limpiar(clave),
  }
}
