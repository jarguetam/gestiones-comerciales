export async function logoutCleanup(opts: {
  userId: string
  tenantId: string
  deleteSession: () => Promise<void>
  clearCola: (clave: string) => Promise<void>
  invalidateFcm: () => Promise<void>
}): Promise<void> {
  await opts.deleteSession()
  await opts.clearCola(`${opts.tenantId}:${opts.userId}`)
  await opts.invalidateFcm()
}
