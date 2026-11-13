/**
 * Espera una tarea como máximo `ms` (sin Expo, para poder probarla). No la cancela: sigue
 * corriendo y, si falla después del límite, también se avisa. Nunca rechaza.
 */
type Advertir = (mensaje: string, detalle: unknown) => void

export async function intentarConLimite(
  tarea: () => Promise<unknown>,
  ms: number,
  mensaje: string,
  advertir: Advertir = (m, d) => console.warn(m, d),
): Promise<void> {
  let temporizador: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<'limite'>((resolve) => {
    temporizador = setTimeout(() => resolve('limite'), ms)
  })
  const trabajo = Promise.resolve().then(tarea).then(() => 'ok' as const)
  try {
    if ((await Promise.race([trabajo, limite])) === 'limite') {
      advertir(mensaje, new Error(`sin respuesta en ${ms} ms`))
      trabajo.catch((e: unknown) => advertir(mensaje, e))
    }
  } catch (e) {
    advertir(mensaje, e)
  } finally {
    clearTimeout(temporizador)
  }
}
