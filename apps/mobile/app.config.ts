import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Inyecta EXPO_PUBLIC_* en extra para el runtime nativo.
 * El build falla en runtime (GC-CORE-001) si URL o anon key faltan.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? 'gestiones-comerciales',
        project: process.env.SENTRY_PROJECT ?? 'mobile',
      },
    ],
  ],
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT,
  },
})
