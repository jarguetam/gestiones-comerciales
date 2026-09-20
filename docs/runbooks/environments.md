# Entornos: local y producción

Decisión operativa del 2026-09-20: el Supabase remoto actual es producción;
desarrollo usa Supabase local. Staging remoto es una capacidad optativa, no un
requisito para desarrollar. La entrega inicial se describe en
`openspec/changes/prepare-android-pilot/`.

## Mapa

| Entorno | Supabase | Host de la app | GitHub Environment |
|---|---|---|---|
| `local` | `supabase start` | Vite `http://localhost:5173` / preview `http://127.0.0.1:4173` | — |
| `staging` (optativo) | proyecto aislado (misma región/major que prod) | Vite en CI (`vite preview`), nunca github.io/staging | `staging` |
| `production` | `xcoeipsnykceorcvjwve` | GitHub Pages (solo este entorno) | `production` |

No existe un site Pages de staging. Los jobs `supabase-staging`, `e2e-staging`
y `ops-backup-staging` requieren la variable **de repositorio**
`ENABLE_STAGING=true`; si falta, se omiten. Solo habilitarla con un proyecto
aislado y los secretos de staging completos. Nunca copiar las credenciales de
producción a staging para hacer pasar esos jobs.

## Desarrollo local

1. Usar Node **22.14.0**, pnpm **9.15.9**, Docker Desktop iniciado y Supabase CLI.
2. Desde la raíz: `supabase start`. Para un reset deliberado del entorno local:
   `supabase db reset --local`. No ejecutar `db push` para preparar desarrollo.
3. Consultar `supabase status` y copiar la clave pública local a archivos `.env`
   ignorados por Git, partiendo de cada `.env.example`. No usar `service_role`
   en los clientes ni copiar claves productivas a local.
4. Web/backoffice: `VITE_SUPABASE_URL=http://127.0.0.1:54321` y
   `VITE_ENVIRONMENT=local`. Móvil: `EXPO_PUBLIC_ENVIRONMENT=local`.
5. Android Emulator: `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321`.
   Teléfono físico: usar la IPv4 privada del equipo en una LAN de confianza.
   `localhost` en el teléfono apunta al teléfono, no al equipo de desarrollo.

En modo local, un endpoint público falla con `GC-CORE-001`; en modo production,
loopback y direcciones privadas fallan. Los builds web siguen requiriendo
`VITE_SENTRY_DSN` y `VITE_RELEASE`; los valores locales de ejemplo son de prueba.
El CI de fixtures usa loopback y una clave placeholder, sin backend real.

## Piloto remoto

EAS `preview` genera APK y `production` genera AAB. Ambos usan el entorno de
variables EAS `production`, `EXPO_PUBLIC_ENVIRONMENT=production` y el proyecto
remoto actual. Un APK interno también puede escribir en producción. Las cuentas
de piloto deben pertenecer a un tenant identificado, sin datos personales reales
para las pruebas iniciales. Crear ese tenant es un paso operativo pendiente.

El perfil EAS `development` selecciona variables `development` y entorno de app
`local`. Antes de generar un development client, revisar su configuración nativa
y dependencias en el cambio de actualización Expo; este cambio no genera APK/AAB.

## Secrets por Environment

Los valores **no** van al repo. El agente o un admin los carga con `gh secret set --env <nombre>`.

| Secret | staging | production |
|--------|---------|------------|
| `SUPABASE_PROJECT_REF` | ref del proyecto nuevo | `xcoeipsnykceorcvjwve` |
| `SUPABASE_DB_PASSWORD` | propio | propio / rotado |
| `SUPABASE_ACCESS_TOKEN` | org | org |
| `SUPABASE_ANON_KEY` | staging | prod |
| `SUPABASE_SERVICE_ROLE_KEY` | staging (jobs supabase + e2e) | **solo** job `supabase-prod`; nunca Pages |
| `VITE_SUPABASE_URL` | `https://<staging>.supabase.co` | URL de prod |
| `VITE_SUPABASE_ANON_KEY` | staging anon | prod anon |
| `VITE_SENTRY_DSN` | DSN staging | DSN prod |
| `SENTRY_AUTH_TOKEN` | org | org |
| `E2E_ASESOR_PASSWORD` | sintético | — |
| `E2E_ADMIN_PASSWORD` | sintético | — |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_ADMIN_EMAIL` | staging | prod |
| `PAGES_PROD_URL` | — | URL pública de Pages |

Verificación (falla cerrado, `GC-OPS-008`):

```bash
node --experimental-strip-types scripts/ci/check-env-secrets.ts staging
node --experimental-strip-types scripts/ci/check-env-secrets.ts production
```

## Promoción

1. PR: CI local (lockfile, lint, typecheck, unit, deno, pgTAP, e2e de fixtures, gitleaks). No toca remotos.
2. Merge a `main`: staging remoto solo se ejecuta si `ENABLE_STAGING=true`.
3. Producción: `supabase-prod.yml` es **solo** `workflow_dispatch` con SHA. Pages (`pages-prod.yml`) exige `VITE_*` de `production` y falla si faltan.

`xcoeipsnykceorcvjwve` no recibe `db push` desde un pull request.

El gate productivo existente no se elimina en esta entrega. Su adaptación a
local + producción debe exigir evidencia del SHA candidato, pruebas del backend
local y restauración, y smoke productivo controlado. Omitir staging no equivale a
aprobar una promoción. El backup de staging no es un backup de producción.

## Datos

Staging usa `supabase/seeds/staging_synthetic.sql` (`Acme Staging`, `asesor@staging.test`, `admin@staging.test`). Nunca se copia PII de producción.
