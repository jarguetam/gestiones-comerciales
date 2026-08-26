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
| G-2 | Núcleo + módulos optativos | Núcleo rubro-agnóstico; módulos (`crm`, `creditos`, `solicitudes`, `depositos`, `kilometraje`) activables por tenant. |
| G-3 | Configuración sobre código | Catálogos, estados, ventanas de rastreo, formularios y branding son datos. Cero hardcodeos. |

## Índice de la especificación

| Documento | Contenido |
|---|---|---
| [`spec/db/SPEC.md`](spec/db/SPEC.md) | Modelo de datos completo (DDL núcleo + módulos), RLS, RPCs, jobs pg_cron, mapeo legado, NFRs, migración |
| [`spec/backend/SPEC.md`](spec/backend/SPEC.md) | Arquitectura (PostgREST+RPC+Edge), auth/MFA, matriz de permisos, contratos API, códigos GC-*, observabilidad, NFRs |
| [`spec/frontend/SPEC.md`](spec/frontend/SPEC.md) | Web (React+Vite) y móvil (Expo RN), pantallas W-01..W-17 / M-01..M-12, design system multi-tenant, offline-first, testing |
| [`openspec/changes/add-core-platform/`](openspec/changes/add-core-platform/) | Change OpenSpec: proposal, design (D1–D12), tasks y deltas de requisitos con escenarios |

## Mapa del producto

```
NUCLEO (siempre activo)
├── tenant / modulo / tenant_modulo      → multi-rubro y feature flags
├── usuario_plataforma (+tenant)         → backoffice global (superadmin/soporte)
├── usuario / dispositivo                → identidad, jerarquía 4 roles, MFA
├── zona / departamento / municipio      → territorio y geografía
├── persona                              → clientes, prospectos, puntos de venta (ex cliente)
├── actividad / subactividad / visita    → agenda y gestión de campo
├── formulario_plantilla / respuesta     → captura dinámica (ex precalificación)
├── rastreo_ubicacion / config_rastreo   → tracking GPS configurable
├── notificacion / auditoria             → comunicación y trazabilidad

MODULOS OPTATIVOS (por tenant)
├── crm          → lead / lead_estado / lead_actividad / lead_origen (embudo comercial)
├── creditos     → cuenta / cuenta_saldo / movimiento / producto   (ex préstamos SIFCO)
├── solicitudes  → solicitud / estado / archivo / firma            (ex cotización + firma)
├── depositos    → deposito                                         (ex depósitos pendientes)
└── kilometraje  → kilometraje                                      (ex km del mes)
```

## Cómo leerlo

1. **DB primero** (`spec/db`): el modelo es el contrato; define entidades, RLS y funciones.
2. **Backend** (`spec/backend`): cómo se expone el modelo (composición, permisos, errores).
3. **Frontend** (`spec/frontend`): cómo lo consumen web y móvil (pantallas, theming, offline).
4. **OpenSpec change** (`openspec/changes/add-core-platform/`): si se usa el flujo OpenSpec,
   `proposal.md` (por qué), `design.md` (decisiones D1–D12 con alternativas), `tasks.md`
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

## Estado del proyecto (2026-08-26)

| Recurso | Detalle |
|---|---|
| Repo | `jarguetam/gestiones-comerciales` (privado) |
| Supabase | Org **GestionesComerciales** · Proyecto **GestionesComercialesApp** (`xcoeipsnykceorcvjwve`) · Postgres 17 · us-west-2 |
| Plan | GitHub Projects: [Gestiones Comerciales — Plan de Implementación](https://github.com/users/jarguetam/projects/1) (34 tareas, F0–F3) |
| Fase actual | **F0 — Plataforma y backoffice global** |

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

## Próximos pasos (según tasks.md)

1. **F0 (en curso):** aplicar migraciones al proyecto Supabase + seeds; crear superadmin de
   plataforma; wizard de alta de primera empresa.
2. **F1:** núcleo operativo (personas, visitas, rastreo) + apps web/móvil MVP.
3. **F2:** CRM leads (pipeline, conversión lead→visita→persona).
4. **F3:** módulos de rubro por tenant (creditos, solicitudes, depositos, kilometraje).
