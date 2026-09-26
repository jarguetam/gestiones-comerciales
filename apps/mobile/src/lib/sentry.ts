/**
 * Sentry React Native. Sin DSN en test/dev no crashea.
 * El build de producción (EXPO_PUBLIC_ENVIRONMENT=production) exige DSN (GC-CORE-001).
 * La exclusión de PII depende también del contenido de los eventos automáticos.
 */
declare const process: { env: Record<string, string | undefined> }
type SentrySdk = Pick<typeof import('@sentry/react-native'), 'init'>

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
  loadSentry: () => Promise<SentrySdk> = () => import('@sentry/react-native'),
): Promise<{ enabled: boolean }> {
  const cfg = resolverInitSentry(env)
  if (!cfg.enabled) return { enabled: false }
  const Sentry = await loadSentry()
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
  return { enabled: true }
}
