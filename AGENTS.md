# AGENTS.md — Gestiones Comerciales

Monorepo: `apps/web` (empresa), `apps/backoffice` (plataforma), `apps/mobile` (campo),
`supabase/` (SQL + Edge). Specs en `spec/` y `docs/`.

## UI nueva

Toda pantalla o control nuevo usa el kit en `src/components/ui` (web/backoffice) o
`apps/mobile/src/components/ui` + `useTheme()`. Detalle, tokens y Do/Don’t:
[`docs/frontend/design-system.md`](docs/frontend/design-system.md).

- No hex sueltos en features nuevas (`bg-canvas`, `border-line`, `bg-primary`, `text-ink`).
- Listados: `EmptyState` / `Vacio`, `TableSkeleton` / `Cargando`, toasts en mutaciones.
- IDs de spec (`W-03`, `P-05`, `M-02`) en `data-spec` o comentario de archivo, **nunca**
  como eyebrow visible. Playwright usa `[data-spec="…"]`.
- CRM y Personas en web son layout **desktop** (lista+ficha / kanban). No reintroducir
  `PhoneMockup`, `BottomNav` ni el showcase calendar.
- Labels con `htmlFor` (web) o `accessibilityLabel` / `accessibilityState` (móvil).

## Tests

```bash
pnpm -r typecheck
pnpm -r test
# e2e (demo, sin backend):
pnpm --filter @gc/web test:e2e
pnpm --filter @gc/backoffice test:e2e
```

Unitarios: `node --experimental-strip-types --test tests/*.test.ts` (web/mobile) y
`src/features/**/*.test.ts` (backoffice). No hay React Testing Library.

## Datos y backend

Reglas de negocio en RPC/Edge, no en el cliente. Códigos `GC-*` se muestran al usuario
(mensaje humano + código). No migraciones ni Edge desde un cambio de UI salvo que el
ticket lo pida.

`DEMO_MODE` (sin `VITE_` / `EXPO_PUBLIC_` de Supabase) debe seguir abriendo el preview
estático.

## Tipos de Supabase

Generar tipos del schema (requiere proyecto linkeado y credenciales):

```bash
supabase gen types typescript --linked > apps/web/src/types/database.ts
```

Si no hay login/`SUPABASE_ACCESS_TOKEN`, el comando no corre: no bloquea UI ni CI.
