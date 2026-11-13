export async function logoutCleanup(opts: {
  userId: string
  tenantId: string
  /** Registros sin enviar; si hay alguno, la cola se conserva en el teléfono. */
  pendientes: number
  deleteSession: () => Promise<void>
  clearCola: (clave: string) => Promise<void>
  clearCache: (clave: string) => Promise<void>
  invalidateFcm: () => Promise<void>
}): Promise<{ colaConservada: boolean }> {
  const clave = `${opts.tenantId}:${opts.userId}`
  const colaConservada = opts.pendientes > 0
  if (!colaConservada) await opts.clearCola(clave)
  await opts.deleteSession()
  await opts.clearCache(clave)
  await opts.invalidateFcm()
  return { colaConservada }
}
