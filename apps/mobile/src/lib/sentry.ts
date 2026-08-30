/**
 * Sentry React Native. Sin DSN en test/dev no crashea.
 * El build de producción (EXPO_PUBLIC_ENVIRONMENT=production) exige DSN (GC-CORE-001).
 * No enviar PII: email, tokens, documento, lat/lng.
 */
declare const process: { env: Record<string, string | undefined> }

export function resolverInitSentry(env: Record<string, string | undefined> = process.env) {
  const dsn = env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? ''
  const production = env.EXPO_PUBLIC_ENVIRONMENT === 'production'
  const test = env.NODE_ENV === 'test'
  if (!dsn) {
    if (production && !test) {
      throw new Error('Falta EXPO_PUBLIC_SENTRY_DSN en el build de producción (GC-CORE-001)')
    }
    return { enabled: false as const }
  }
  return { enabled: true as const, dsn }
}

export async function initSentryMobile(
  env: Record<string, string | undefined> = process.env,
): Promise<{ enabled: boolean }> {
  const cfg = resolverInitSentry(env)
  if (!cfg.enabled) return { enabled: false }
  try {
    const Sentry = await import('@sentry/react-native')
    Sentry.init({
      dsn: cfg.dsn,
      enabled: true,
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.user) {
          delete event.user.email
          delete event.user.ip_address
        }
        return event
      },
    })
  } catch {
    /* Paquete nativo ausente en unit test / preview web. */
  }
  return { enabled: true }
}
