const PII = /email|password|token|secret|documento|lat|lng|longitud|latitud|coordenad|authorization/i

export interface SentryInitInput {
  dsn?: string | null
  sentryDsn?: string | null
  environment: string
  release: string
}

export interface SentryEventLike {
  extra?: Record<string, unknown>
  tags?: Record<string, string>
  request?: { data?: unknown }
}

let bootstrapped: SentryInitInput | null = null

function resolveDsn(input: SentryInitInput): string | undefined {
  const raw = input.sentryDsn ?? input.dsn
  return raw?.trim() || undefined
}

export function initSentry(input: SentryInitInput): SentryInitInput {
  const dsn = resolveDsn(input)
  if (!dsn) throw new Error('GC-CORE-001')
  bootstrapped = { dsn, environment: input.environment, release: input.release }
  return bootstrapped
}

export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
  const extra = event.extra ? { ...event.extra } : undefined
  if (extra) {
    for (const key of Object.keys(extra)) {
      if (PII.test(key)) delete extra[key]
    }
  }
  return { ...event, extra }
}

export function sentryTags(input: { tenantId?: string | null; requestId?: string | null }): Record<string, string> {
  const tags: Record<string, string> = {}
  if (input.tenantId) tags.tenant_id = input.tenantId
  if (input.requestId) tags.request_id = input.requestId
  return tags
}

export function currentSentryInit(): SentryInitInput | null {
  return bootstrapped
}

export async function bootSentry(input: SentryInitInput): Promise<void> {
  const cfg = initSentry(input)
  try {
    const Sentry = await import('@sentry/react')
    Sentry.init({
      dsn: cfg.dsn!,
      environment: cfg.environment,
      release: cfg.release,
      beforeSend(event) {
        const cleaned = scrubSentryEvent({
          extra: event.extra as Record<string, unknown> | undefined,
          tags: event.tags as Record<string, string> | undefined,
        })
        event.extra = cleaned.extra
        return event
      },
    })
  } catch {
    /* SDK ausente en unitarios */
  }
}

export async function reportError(
  err: unknown,
  tags: { tenant_id?: string; request_id?: string } = {},
): Promise<void> {
  try {
    const Sentry = await import('@sentry/react')
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(tags)) {
        if (v) scope.setTag(k, v)
      }
      Sentry.captureException(err)
    })
  } catch {
    /* sin SDK */
  }
}
