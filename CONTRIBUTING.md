# Contribuir a Gestiones Comerciales

## Flujo de trabajo

1. Rama por feature: `feat/<modulo>-<descripcion>` o `fix/<descripcion>` desde `main`.
2. Commits convencionales (Conventional Commits): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `spec:`.
3. Migraciones SQL forwards-only en `supabase/migrations/` con timestamp: `YYYYMMDDHHMMSS_nombre.sql`.
4. Edge Functions en `supabase/functions/<nombre>/index.ts` (Deno + TS).
5. Todo PR pasa CI: lint + typecheck + tests + revisión de migraciones.

## Estructura

```
apps/web          → React + Vite (empresa: admin/gerente/supervisor)
apps/mobile       → Expo React Native (asesor de campo)
apps/backoffice   → React + Vite (plataforma: superadmin/soporte)
supabase/         → migraciones, funciones, seeds
spec/ + openspec/ → especificación SDD/OpenSpec (fuente de verdad del diseño)
docs/             → ADRs y playbook de onboarding de rubros
```

## Reglas del proyecto

- **RLS en 100% de tablas de negocio** — nada de tablas expuestas sin política.
- **Cero hardcodeos** de tenant, rubro, catálogos, ventanas horarias o formularios: todo es dato (G-3).
- La especificación (`spec/`, `openspec/`) es fuente de verdad: cambios de diseño = nuevo change OpenSpec.
- Errores de negocio siempre con código `GC-<MOD>-NNN` y catálogo i18n.
- Migraciones forwards-only: nunca se edita una migración aplicada; se crea una nueva.
