export async function logoutCleanup(opts: {
  userId: string
  tenantId: string
  /** Registros sin enviar; si hay alguno, la cola se conserva en el teléfono. */
  pendientes: number
  deleteSession: () => Promise<void>
  clearCola: (clave: string) => Promise<void>
  clearCache: (clave: string) => Promise<void>
  invalidateFcm: () => Promise<void>
  advertir?: (mensaje: string, detalle: unknown) => void
}): Promise<{ colaConservada: boolean }> {
  const clave = `${opts.tenantId}:${opts.userId}`
  const colaConservada = opts.pendientes > 0
  if (!colaConservada) await opts.clearCola(clave)
  await opts.deleteSession()
  await opts.clearCache(clave)
  try {
    await opts.invalidateFcm()
  } catch (e) {
    // Sin red el dispositivo no se puede desactivar: el cierre de sesión debe completarse igual.
    ;(opts.advertir ?? ((m, d) => console.warn(m, d)))('GC-AUTH-029: no se pudo desactivar el dispositivo', e)
  }
  return { colaConservada }
}
