export type AuthResetClient = {
  auth: {
    resetPasswordForEmail: (
      email: string,
      opts: { redirectTo: string },
    ) => Promise<{ error: { message?: string } | null }>
    updateUser?: (attrs: { password: string }) => Promise<{ error: { message?: string } | null }>
  }
}

export function resetRedirectTo(location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}#/recuperar`
}

export async function solicitarReset(
  email: string,
  client: AuthResetClient,
  location: { origin: string; pathname: string } = globalThis.location,
): Promise<void> {
  const trimmed = email.trim()
  if (!trimmed) throw new Error('GC-AUTH-021')
  const { error } = await client.auth.resetPasswordForEmail(trimmed, {
    redirectTo: resetRedirectTo(location),
  })
  if (error) throw new Error('GC-AUTH-021')
}

export async function actualizarPassword(password: string, client: AuthResetClient): Promise<void> {
  if (!password || password.length < 8) throw new Error('GC-AUTH-021')
  if (!client.auth.updateUser) throw new Error('GC-AUTH-021')
  const { error } = await client.auth.updateUser({ password })
  if (error) throw new Error('GC-AUTH-021')
}
