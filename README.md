# Gestiones Comerciales — Especificación de plataforma multi-rubro

**Versión:** 1.0 · 2026-08-26
**Origen:** generalización de `spec-agromoney-v2.md` (Agromoney Gestiones v2 — microfinanzas agropecuarias)
**Método:** SDD (Spec-Driven Development) + OpenSpec (cambios versionados con proposal/design/tasks y requisitos con escenarios)

---

## Qué es

Plataforma **genérica multi-rubro** para gestión de fuerza comercial en campo. Un solo producto,
N rubros (microfinanzas, distribución, retail, seguros, farmacéuticas, servicios). El 80% del
dominio es común (visitas, formularios, rastreo, jerarquía, notificaciones); lo específico del
rubro es **configuración**, no código.

Tres reglas de diseño:

| # | Regla | Mecanismo |
|---|-------|-----------|
| G-1 | Multi-tenant estricto | `tenant_id` + RLS por claims del JWT. Un rubro = un tenant. |
| G-1b | Jerarquía comercial | `asesor → supervisor → gerente` (`jefe_id` + `subordinados()` recursivo); alcance y drill-down por rol. |
| G-2 | Núcleo + módulos optativos | Núcleo rubro-agnóstico; módulos (`creditos`, `solicitudes`, `depositos`, `kilometraje`) activables por tenant. |
| G-3 | Configuración sobre código | Catálogos, estados, ventanas de rastreo, formularios y branding son datos. Cero hardcodeos. |

## Índice de la especificación

| Documento | Contenido | Líneas |
|---|---|---|
| [`spec/db/SPEC.md`](spec/db/SPEC.md) | Modelo de datos completo (DDL núcleo + módulos), RLS, RPCs, jobs pg_cron, mapeo legado, NFRs, migración | 635 |
| [`spec/backend/SPEC.md`](spec/backend/SPEC.md) | Arquitectura (PostgREST+RPC+Edge), auth/MFA, matriz de permisos, contratos API, códigos GC-*, observabilidad, NFRs | 265 |
| [`spec/frontend/SPEC.md`](spec/frontend/SPEC.md) | Web (React+Vite) y móvil (Expo RN), pantallas W-01..W-14 / M-01..M-10, design system multi-tenant, offline-first, testing | 209 |
| [`openspec/changes/add-core-platform/`](openspec/changes/add-core-platform/) | Change OpenSpec: proposal, design (D1–D8), tasks y deltas de requisitos con escenarios | — |

## Mapa del producto

```
NUCLEO (siempre activo)
├── tenant / modulo / tenant_modulo      → multi-rubro y feature flags
├── usuario / dispositivo                → identidad, jerarquía, MFA
├── zona / departamento / municipio      → territorio y geografía
├── persona                              → clientes, prospectos, puntos de venta (ex cliente)
├── actividad / subactividad / visita    → agenda y gestión de campo
├── formulario_plantilla / respuesta     → captura dinámica (ex precalificación)
├── rastreo_ubicacion / config_rastreo   → tracking GPS configurable
├── notificacion / auditoria             → comunicación y trazabilidad

MODULOS OPTATIVOS (por tenant)
├── crm          → lead / lead_estado / lead_actividad / lead_origen (embudo comercial)
├── creditos    → cuenta / cuenta_saldo / movimiento / producto   (ex préstamos SIFCO)
├── solicitudes → solicitud / estado / archivo / firma            (ex cotización + firma)
├── depositos   → deposito
└── kilometraje → kilometraje
```

## Cómo leerlo

1. **DB primero** (`spec/db`): el modelo es el contrato; define entidades, RLS y funciones.
2. **Backend** (`spec/backend`): cómo se expone el modelo (composición, permisos, errores).
3. **Frontend** (`spec/frontend`): cómo lo consumen web y móvil (pantallas, theming, offline).
4. **OpenSpec change** (`openspec/changes/add-core-platform/`): si se usa el flujo OpenSpec,
   `proposal.md` (por qué), `design.md` (decisiones D1–D8 con alternativas), `tasks.md`
   (backlog ejecutable), `specs/` (requisitos con escenarios WHEN/THEN).

## Stack resumido

| Capa | Tecnología |
|---|---|
| DB + API | PostgreSQL 17 (Supabase): PostgREST + RPC + RLS |
| Lógica/efectos | Edge Functions (Deno/TS): push, mail, PDF, import, ingesta GPS, jobs |
| Auth | Supabase Auth (JWT con claims de tenant, MFA TOTP) |
| Web empresa | React 18 + TS + Vite + TanStack Query + Tailwind + shadcn/ui |
| Backoffice plataforma | React 18 + TS + Vite (admin global: empresas, módulos, usuarios, salud) |
| Móvil | React Native + Expo + SQLite offline + expo-location + FCM |
| Jobs | pg_cron + pg_net → Edge `notify-jobs` |

## Estado del proyecto (2026-08-29)

| Recurso | Detalle |
|---|---|
| Repo | `jarguetam/gestiones-comerciales` (privado) |
| Supabase | Org **GestionesComerciales** · Proyecto **GestionesComercialesApp** (`xcoeipsnykceorcvjwve`) · Postgres 17 · us-west-2 |
| Fase actual | Hardening productivo. Gates 0–5 en `main`. **Gate 6 (go-live) en curso**. Node **22.14.0** / pnpm **9.15.9**. **42 migraciones** en `supabase/migrations/`. **8 Edge Functions** (`auth-guard`, `importer`, `invitar-usuario`, `notify-jobs`, `pdf-solicitud`, `push-notifications`, `rastreo-ingesta`, `webhook-tenant`). Invitaciones y recupero van por **SMTP de Auth**; el `emailer` genérico queda fuera de v1. |

### Cómo entrar (web y móvil)

| Superficie | Qué pasa si faltan keys | Qué pasa si hay URL + anon JWT |
|---|---|---|
| Web local (`pnpm --filter @gc/web dev`) | Build/login fallan con **GC-CORE-001**. Sin modo demo. | Login real: **Ingresar** contra Supabase Auth. |
| GitHub Pages | `pages-prod` falla cerrado (`GC-OPS-008`) si faltan `VITE_SUPABASE_*` o `VITE_SENTRY_DSN`. | Login contra Supabase. Sin botón de demo. |
| Staging | Vite en el runner CI (`e2e-staging.yml`). No hay site `/staging/` en github.io. | Usuarios sintéticos (`asesor@staging.test`). |
| Móvil (EAS preview / AAB Internal) | Build falla si faltan `EXPO_PUBLIC_SUPABASE_*` (**GC-CORE-001**). | Login real. |

La anon key es pública (va al bundle). Nunca commitees `service_role`.

### Quickstart

```bash
git clone https://github.com/jarguetam/gestiones-comerciales.git
cd gestiones-comerciales

# CLI de Supabase + aplicar migraciones F0
npx supabase login
npx supabase link --project-ref xcoeipsnykceorcvjwve
npx supabase db push            # aplica supabase/migrations/*
npx supabase db reset           # local: migraciones + seeds
```

### Estructura del repo

```
spec/ + openspec/   → especificación SDD/OpenSpec (fuente de verdad)
docs/adr/           → ADR-001..006 (decisiones D1–D12 condensadas)
supabase/
  migrations/       → 001 tenancy/plataforma · 002 funciones núcleo (F0)
  seed/             → módulos + geografía base
  functions/        → auth-guard (rate limit login)
  config.toml       → config del proyecto Supabase
apps/               → web / mobile / backoffice (scaffold en F1)
```

## Próximos pasos

1. **Gate 6:** `pnpm ops:golive` debe imprimir `ready: true`. Runbook: `docs/runbooks/golive.md`.
2. **Staging + SMTP + PITR** reales (environments GitHub). Restore drill: `scripts/ops/restore-staging-dryrun.sh`.
3. **Play Internal** es opcional; si no hay consola, GO condicional web-only. iOS fuera.
