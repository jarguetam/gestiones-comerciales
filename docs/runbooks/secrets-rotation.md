# Rotación de secretos

Orden canónico: webhook (app) → Edge secrets → GitHub Environment → EAS → **último** anon (rompe clientes; coordinar Gate 6).

## Webhook HMAC (staging primero)

```bash
SUPABASE_URL=https://<staging>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
TENANT_ID=<uuid> \
node --experimental-strip-types scripts/ops/rotate-webhook-secret.ts
```

Llama RPC `admin_webhook_rotar_secret`. El plain se muestra **una vez** al caller; el script solo loguea `last4`.

## Edge secrets

```bash
npx supabase secrets set NOTIFY_JOBS_SECRET=... --project-ref <ref>
```

## GitHub Environments

`gh secret set --env staging|production NAME`

## Anon / service_role (JWT keys)

Management API `POST /v1/projects/{ref}/secrets` **no rota** las JWT keys de Auth. El script `enable-pitr` / rotación sale `GC-OPS-006` si se pide rotar JWT por API.

Fallback: `supabase projects api-keys --project-ref <ref>` (CLI) o Dashboard del owner. Tras rotar anon: actualizar `VITE_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, rebuild Pages y EAS, y coordinar Gate 6.

## Firebase / FCM

Reintento de restricción de API key: Gate 1 script. Si falta `GOOGLE_SERVICE_ACCOUNT_KEY`: `GC-OPS-008`.
