# AGENTS.md — Gestiones Comerciales

Monorepo: `apps/web` (empresa), `apps/backoffice` (plataforma), `apps/mobile` (campo),
`supabase/` (SQL + Edge). Specs en `spec/` y `docs/`.

## Gobernanza de ramas y PRs

Antes de escribir código, SIEMPRE:

1. `git fetch origin main` y revisar el estado real del remoto. El checkout local
   puede estar horas desactualizado.
2. `gh pr list --state open` — si ya existe un PR abierto del mismo tema o módulo,
   **continuar sobre esa rama** (`git fetch origin <rama> && git checkout <rama>`),
   no crear una rama ni un PR nuevos. Un tema = una rama = un PR.
3. Si la rama del PR quedó atrás de `main` (otros PRs tocaron los mismos archivos),
   mergear `origin/main` a la rama y resolver conflictos ANTES de agregar trabajo.
   Nunca dejar un PR en estado `CONFLICTING`.
4. Buscar en el árbol si ya existe una implementación de lo que se va a construir
   (p. ej. `rg -l cola apps/mobile/src/lib`). No duplicar libs que ya están en
   `main` o en un PR abierto.

Al terminar: si el PR se mergea, borrar la rama remota
(`git push origin --delete <rama>`). No dejar ramas huérfanas.

## Spec-Driven Development (features nuevas)

Una **feature nueva** (pantalla, módulo, RPC/Edge, flujo nuevo o cambio de modelo
de datos) NUNCA empieza por código. Flujo obligatorio, en este orden:

1. **Spec primero.** Crear `openspec/changes/<kebab-del-cambio>/` con:
   - `proposal.md`: problema, cambio propuesto, impacto, out-of-scope y una sección
     **"Preguntas de aclaración"**: las dudas concretas para el usuario, cada una con
     la respuesta que se asume por defecto si no contesta.
   - `specs/`: requisitos con escenarios WHEN/THEN (mismo formato que
     `openspec/changes/add-core-platform/specs/`).
   - `design.md`: decisiones con alternativas, solo si hay trade-offs reales.
2. **Parar y preguntar.** Entregar el proposal con las preguntas al usuario ANTES de
   escribir código. Se implementa recién cuando el usuario responde o aprueba
   explícitamente los supuestos. Si aprueba sin responder alguna pregunta, la
   respuesta por defecto queda registrada en el proposal como supuesto.
3. **Plan.** Con las respuestas, escribir `tasks.md`: tareas chicas y verificables,
   cada una con su criterio de done (test unitario, pgTAP o e2e).
4. **Implementación.** Un PR por change, referenciando `openspec/changes/<nombre>`
   en la descripción; marcar los checkboxes de `tasks.md` a medida que se avanza.

No aplica a bugfixes, refactors ni ajustes de copy/estilo: esos siguen la
gobernanza de ramas normal, sin proposal.

## UI de campo 2026

Toda pantalla o control nuevo usa el kit en `src/components/ui` (web/backoffice) o
`apps/mobile/src/components/ui` + `useTheme()`. Detalle y Do/Don’t:
[`docs/frontend/design-system.md`](docs/frontend/design-system.md).

Identidad: herramienta de ruta (asesor en calle + supervisor en desktop).
**Murió** la regla crema/Playfair. No reintroducir serif, canvas `#F3EEE4`,
pasteles de evento, header púrpura, `PhoneMockup` ni bottom-nav de calendario.

- Tipografía: Plus Jakarta Sans. Títulos humanos (`text-xl`), no hero de landing.
- Tokens: `bg-canvas` `#FAFAF8`, `text-ink` `#111111`, `border-line`, `bg-primary`.
  Estados: ok / warn / danger. **Sin rail** de acento en visitas/leads/cards.
- Campo (`< md` y móvil): targets ≥ 44px, bottom nav ≥ 56px con iconos SVG,
  4 destinos + Más, jornada (hora + cliente + estado + lugar), check-in con icono.
  **Salir** visible en header (desktop y móvil).
- Desktop: sidebar estrecho, nav texto, contenido full-bleed, kanban real.
- IDs de spec (`W-03`, `P-05`, `M-02`) en `data-spec` o comentario de archivo,
  **nunca** como eyebrow visible. Playwright usa `[data-spec="…"]`.
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

Sin `VITE_` / `EXPO_PUBLIC_` de Supabase el build falla (`GC-CORE-001`) y el login
muestra el código; no hay `DEMO_MODE` ni «Entrar al tablero».

## Tipos de Supabase

Generar tipos del schema (requiere proyecto linkeado y credenciales):

```bash
supabase gen types typescript --linked > apps/web/src/types/database.ts
```

Si no hay login/`SUPABASE_ACCESS_TOKEN`, el comando no corre: no bloquea UI ni CI.
