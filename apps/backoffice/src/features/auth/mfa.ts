export interface NivelAal {
  currentLevel: string | null
  nextLevel: string | null
}

/** P-01: si el usuario de plataforma exige TOTP, hay que verificar el factor. */
export function requierePasoTotp(aal: NivelAal | null | undefined): boolean {
  return aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2'
}

export function etiquetaFactor(factor: { friendlyName?: string | null; status: string }): string {
  const nombre = factor.friendlyName?.trim()
  return nombre ? nombre : `TOTP (${factor.status})`
}
