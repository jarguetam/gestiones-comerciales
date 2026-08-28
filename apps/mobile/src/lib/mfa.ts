export interface NivelAal {
  currentLevel: string | null
  nextLevel: string | null
}

/** M-01: si el tenant exige TOTP, hay que verificar el factor antes de entrar. */
export function requierePasoTotp(aal: NivelAal | null | undefined): boolean {
  return aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2'
}
