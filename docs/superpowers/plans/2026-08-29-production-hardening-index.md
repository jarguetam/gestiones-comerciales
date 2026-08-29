# Production Hardening — Índice y orden de ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each gate plan task-by-task. Do not implement from this index. This file is the coverage map and sequencing contract.

**Goal:** Cubrir el 100% de `docs/superpowers/specs/2026-08-29-production-hardening-design.md` con planes ejecutables, uno por gate.

**Architecture:** El programa se implementa en siete planes. Cada plan produce software o automatización verificable de forma independiente. Un gate posterior no empieza si el anterior no cumple su Definition of Done.

**Tech Stack:** Supabase Postgres 17 + RLS + Edge Deno, React 18 + Vite, Expo SDK 51, Playwright, pgTAP, GitHub Actions, EAS, Sentry.

## Global Constraints

- Alcance de esta salida: web, backoffice y Android mediante Google Play Internal Testing.
- iOS, PWA, Storybook e internacionalización inglesa quedan fuera.
- El proyecto Supabase actual `xcoeipsnykceorcvjwve` será producción.
- Se creará un proyecto Supabase separado para staging.
- GitHub Pages seguirá alojando web y backoffice de producción.
- Los cambios de base de datos usarán migraciones expand/contract compatibles, sin downtime.
- Android tendrá dos artefactos: APK preview instalable contra staging y AAB firmado contra producción.
- Sentry cubrirá web, backoffice y móvil; Supabase Logs y alertas cubrirán DB y Edge.
- El modo demo y sus datos se eliminarán de las tres aplicaciones.
- El rastreo será obligatorio para asesores cuando el administrador del tenant lo active en `config_rastreo`. El asesor no tendrá interruptor para desactivarlo.
- La ejecución no dependerá de acceso manual del usuario a Supabase. La automatización usará credenciales existentes en GitHub y comprobará sus permisos antes de realizar cambios.
- Códigos de negocio `GC-*` se muestran al usuario (mensaje humano + código).
- IDs de spec (`W-03`, `P-05`, `M-02`) en `data-spec` o comentario de archivo, nunca como eyebrow visible.
- Node único fijado a `22.14.0`; `packageManager` `pnpm@9.15.9`.
- `pnpm install --frozen-lockfile` en todos los jobs.
- Ningún workflow continúa con warning si falta un secret, migración, función o probe.

## Orden obligatorio

| Orden | Plan | Entregable independiente |
|---|---|---|
| 0 | `2026-08-29-gate-0-inventory.md` | Preflight + inventario + línea base sin mutar prod |
| 1 | `2026-08-29-gate-1-security.md` | Secretos, authz Edge, RLS, MFA, rate limit, CORS |
| 2 | `2026-08-29-gate-2-cicd.md` | Staging, CI fail-closed, promoción, lockfile, lint |
| 3 | `2026-08-29-gate-3-web-runtime.md` | Sin demo, guards, ErrorBoundary, bundle, a11y |
| 4 | `2026-08-29-gate-4-android.md` | EAS, APK/AAB, rastreo obligatorio, Detox |
| 5 | `2026-08-29-gate-5-ops.md` | Sentry, alertas, PITR, retención, privacidad, runbooks |
| 6 | `2026-08-29-gate-6-golive.md` | Checklist de aceptación y smoke no destructivo |

Gate 3 y Gate 4 pueden empezar en paralelo **después** de Gate 1 si Gate 2 ya dejó lint/CI locales. Gate 5 puede solaparse con 3/4 en instrumentación, pero no cierra antes de que existan builds reales. Gate 6 es el último.

## Matriz spec → plan

| Requisito del diseño | Plan |
|---|---|
| Preflight de secretos y permisos | Gate 0 |
| Inventario de migraciones/Edge/hooks/cron/buckets | Gate 0 |
| 26 migraciones vs remoto; detener ante drift | Gate 0 |
| Línea base de versiones y export no secreto | Gate 0 |
| Falla con permiso exacto si no puede crear staging | Gate 0 + Gate 2 |
| Sacar `webhook_secret` de `tenant.configuracion` | Gate 1 |
| Vault/tabla privada + RPC de existencia/rotación | Gate 1 |
| Rotar HMAC existentes | Gate 1 |
| Restringir API key Firebase | Gate 1 + Gate 5 |
| `invitar-usuario` autoriza antes de `createUser` + rollback | Gate 1 |
| `importer` autoriza antes de Storage | Gate 1 |
| Quitar fallback `service_role` de `pdf-solicitud` | Gate 1 |
| `push-notifications` restringido | Gate 1 |
| Revocar `seed_solicitud_estados` | Gate 1 |
| Bloquear UPDATE de estados | Gate 1 |
| Unificar `tenant_id_actual()` / `rol_actual()` | Gate 1 |
| Verificar Auth hook | Gate 0 + Gate 1 + Gate 2 |
| Tipos Supabase versionados | Gate 1 |
| AAL2 plataforma + gate `usuario_plataforma` | Gate 1 + Gate 3 |
| Guards de rutas admin web | Gate 3 |
| `onAuthStateChange` móvil | Gate 4 |
| Recuperación de contraseña | Gate 3 + Gate 4 |
| Rate limit login real + 429 | Gate 1 |
| `verify_jwt` explícito | Gate 1 |
| CORS fail-closed | Gate 1 |
| Staging + secrets por environment | Gate 2 |
| Sustituir refs hardcodeadas | Gate 2 |
| Auth URLs, SMTP, cron, Storage en ambos proyectos | Gate 2 + Gate 5 |
| Datos sintéticos, no PII | Gate 2 |
| CI PR: frozen, lint, typecheck, unit, deno, pgTAP, e2e demo-less, gitleaks | Gate 2 |
| Node único + least privilege | Gate 2 |
| Staging post-merge + APK preview | Gate 2 + Gate 4 |
| Promoción manual fail-closed + anti-demo en bundle | Gate 2 + Gate 3 + Gate 6 |
| Pages solo producción; staging = Vite en CI | Gate 2 (no hay site Pages de staging) |
| Eliminar DEMO_MODE y datos ficticios | Gate 3 + Gate 4 |
| Error + `GC-*` + retry, nunca demo | Gate 3 |
| Build falla sin env | Gate 2 + Gate 3 + Gate 4 |
| ErrorBoundary + Sentry | Gate 3 + Gate 4 + Gate 5 |
| Offline web | Gate 3 |
| Code-split mapa + presupuesto bundle | Gate 3 |
| Axe todas las rutas + labels + firma | Gate 3 |
| Tokens de branding en mapa | Gate 3 |
| CSP sin `unsafe-inline` scripts | Gate 3 |
| React Doctor confirmados | Gate 3 |
| Alinear `.env.example` | Gate 2 + Gate 3 |
| EAS projectId, preview APK, production AAB | Gate 4 |
| Expo Doctor / deps SDK | Gate 4 |
| Quitar APKs del git | Gate 4 |
| Rastreo TaskManager + bloqueo por permisos | Gate 4 |
| Detox permisos/offline/sesión | Gate 4 |
| Limpieza de sesión/cola | Gate 4 |
| FCM rotación | Gate 4 + Gate 1 |
| `request_id` E2E | Gate 5 |
| Alertas + panel | Gate 5 |
| PITR 7d + restore drill | Gate 5 |
| Purga GPS 180d + compactación auditoría | Gate 5 |
| Buckets privados | Gate 1 + Gate 5 |
| Política de privacidad + runbooks | Gate 5 |
| SMTP; `emailer` fuera de v1 | Gate 5 |
| `SECURITY.md`, `CODEOWNERS`, Dependabot | Gate 5 |
| Docs reales (26 migraciones, sin 404) | Gate 5 |
| Checklist go-live | Gate 6 |

## Fuera de alcance (ningún plan debe implementarlos)

- Aplicación y distribución iOS.
- PWA o service worker para web.
- Storybook/Chromatic.
- Traducción completa al inglés.
- Sustitución de GitHub Pages por otro hosting.
- Reescritura histórica destructiva de Git para borrar APKs antiguos.
- Nuevos módulos o capacidades de negocio no requeridos por el hardening.
- Función `emailer` genérica.

## Contratos compartidos entre planes

Estos nombres son canónicos. Un plan posterior no puede renombrarlos.

```ts
export type EnvironmentName = 'local' | 'staging' | 'production'

export interface PublicSupabaseConfig {
  url: string
  anonKey: string
  environment: EnvironmentName
}

export interface RequestContext {
  requestId: string
}

/** Solo logs Edge; no ampliar RequestContext. */
export interface EdgeLogFields extends RequestContext {
  tenantId: string | null
  userId: string | null
  fn: string
  outcome: 'ok' | 'error'
}

/** Preflight/CI (no se muestran al usuario). No reutilizar para UI. */
export type PreflightCode =
  | 'GC-OPS-001' | 'GC-OPS-002' | 'GC-OPS-003' | 'GC-OPS-004'
  | 'GC-OPS-005' | 'GC-OPS-006' | 'GC-OPS-007' | 'GC-OPS-008'
  | 'GC-OPS-010' // toolchain Node/pnpm

/** UI: config/red/dominio. No chocar con PreflightCode. */
export type GcOpsUiCode = 'GC-CORE-001'

export type GcCode =
  | 'GC-AUTH-001' | 'GC-AUTH-002' | 'GC-AUTH-003' | 'GC-AUTH-010'
  | 'GC-AUTH-011' | 'GC-AUTH-012' | 'GC-AUTH-013' | 'GC-AUTH-014'
  | 'GC-AUTH-021' | 'GC-AUTH-022' | 'GC-AUTH-030' | 'GC-AUTH-031'
  | 'GC-AUTH-040'
  | 'GC-IMP-010' | 'GC-IMP-011' | 'GC-IMP-012' | 'GC-IMP-013'
  | 'GC-IMP-014' | 'GC-IMP-015' | 'GC-IMP-016' | 'GC-IMP-017'
  | 'GC-IMP-018' | 'GC-IMP-050' | 'GC-IMP-051'
  | 'GC-SOLI-001' | 'GC-SOLI-004' | 'GC-SOLI-011' | 'GC-SOLI-013'
  | 'GC-SOLI-014' | 'GC-SOLI-015'
  | 'GC-PUSH-010' | 'GC-PUSH-011' | 'GC-PUSH-012' | 'GC-PUSH-013'
  | 'GC-PUSH-014' | 'GC-PUSH-015'
  | 'GC-RAS-001' | 'GC-RAS-010' | 'GC-RAS-011' | 'GC-RAS-012'
  | 'GC-DEPO-001' | 'GC-CORE-001'

export interface WebhookSecretStatus {
  tenantId: string
  configurado: boolean
  rotadoEn: string | null
  last4: string | null
}

export function requirePublicConfig(input: {
  url?: string | null
  anonKey?: string | null
  environment: EnvironmentName
}): PublicSupabaseConfig
```

## Cómo validar este índice

```bash
test -f docs/superpowers/specs/2026-08-29-production-hardening-design.md
test -f docs/superpowers/plans/2026-08-29-gate-0-inventory.md
test -f docs/superpowers/plans/2026-08-29-gate-1-security.md
test -f docs/superpowers/plans/2026-08-29-gate-2-cicd.md
test -f docs/superpowers/plans/2026-08-29-gate-3-web-runtime.md
test -f docs/superpowers/plans/2026-08-29-gate-4-android.md
test -f docs/superpowers/plans/2026-08-29-gate-5-ops.md
test -f docs/superpowers/plans/2026-08-29-gate-6-golive.md
```

Expected: exit 0.

## Validación (2026-08-29)

Spec: internamente consistente; decisiones aprobadas = gates; sin TBD. Pages = solo producción (Vite en CI para staging). Invite = validar → createUser → perfil → rollback Auth.

Planes: un archivo por gate + este índice. Contratos canónicos: `requirePublicConfig`, `RequestContext`, `EdgeLogFields`, `WebhookSecretStatus`, `PreflightCode` ≠ códigos UI (`GC-CORE-001`).
