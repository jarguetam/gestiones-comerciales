export type PlataformaRol = 'owner' | 'operador'
export type BackofficeAccess = 'login' | 'enroll_mfa' | 'challenge_mfa' | 'forbidden' | 'ok'

export interface BackofficeAccessInput {
  session: { user?: { app_metadata?: Record<string, unknown> } } | null
  factors: { totp?: Array<{ id: string }> | null } | null
  aal: 'aal1' | 'aal2' | string | null
}

export function plataformaRolDe(
  session: { user?: { app_metadata?: Record<string, unknown> } } | null,
): PlataformaRol | null {
  const meta = session?.user?.app_metadata ?? {}
  const claimed = meta.plataforma_rol
  if (claimed === 'owner' || claimed === 'operador') return claimed
  if (meta.plataforma === true) return meta.superadmin === true ? 'owner' : 'operador'
  return null
}

export function resolveBackofficeAccess(input: BackofficeAccessInput): BackofficeAccess {
  if (!input.session) return 'login'
  if (!plataformaRolDe(input.session)) return 'forbidden'
  const totp = input.factors?.totp ?? []
  if (totp.length === 0) return 'enroll_mfa'
  if (input.aal !== 'aal2') return 'challenge_mfa'
  return 'ok'
}
