# Design system — Gestiones Comerciales

Tokens, primitivos y reglas de UI para `apps/web`, `apps/backoffice` y `apps/mobile`.
Producto de **ruta de campo 2026**: herramienta para el asesor en calle + supervisión
en desktop. No es un organizer, no es un calendario alumni.

El kit es **propio** (no shadcn). Backoffice copia la misma API; no hay package
workspace compartido. El único color que cambia por tenant es el primario.

## Identidad (lo que murió)

No reintroducir: Playfair / serif, canvas crema `#F3EEE4`, pasteles peach/mint/lavender
como marca, header púrpura de bloque, FAB de calendario, `PhoneMockup`,
`Showcase3Phones` ni `BottomNav` de agenda.

## Tokens

Neutros **fijos**. Primario = `--gc-primary` del tenant (web/móvil) o ink de
plataforma (backoffice).

| Token | CSS / RN | Web y móvil | Backoffice |
|---|---|---|---|
| canvas | `--gc-canvas` / `NEUTROS.canvas` | `#FAFAF8` | `#FAFAF8` |
| surface | `--gc-surface` | `#FFFFFF` | `#FFFFFF` |
| line | `--gc-border` | `#E6E4DF` | `#E6E4DF` |
| ink | `--gc-ink` | `#111111` | `#111111` |
| muted | `--gc-muted` | `#52525B` | `#52525B` |
| ok / warn / danger | `--gc-ok` `--gc-warn` `--gc-danger` | `#047857` / `#B45309` / `#B91C1C` | igual |
| primary | `--gc-primary` | tenant (demo `#6D28D9`) | `#111111` |
| motion | `--gc-ease` | `150ms ease` | `150ms ease` |
| touch | `min-h-11` | ≥ 44px (bottom nav ≥ 56px) | ≥ 44px |

**Tipografía:** una sola familia, Plus Jakarta Sans. Títulos de pantalla en
`text-xl font-semibold` (tamaño humano, no hero). Nada de italic serif, ni
`tracking-[0.2em]` / uppercase en chrome.

**Estados:** 3 semánticos (ok / warn / danger) + primary. Badges secos: pill con
borde, sin barra pastel.

Web inyecta `varsDeBranding(tenant.branding)` sobre `:root`. Móvil usa
`temaDe(branding)` + `ThemeProvider`.

No uses hex sueltos en pantallas nuevas: `bg-canvas`, `border-line`, `bg-primary`,
`text-ink`, o `useTheme().primary`.

## Componentes (web / backoffice)

Importar desde `src/components/ui`.

| Componente | Cuándo usarlo |
|---|---|
| `Button` | Acciones. Variantes `primary` / `secondary` / `danger` / `ghost`. `lg` full-width. |
| `Input` `Select` `Textarea` | Campos con `htmlFor` obligatorio (`id` + `label`). `min-h-11`. |
| `Table` `THead` `Th` `TBody` `Tr` `Td` | Listados densos. `TableSkeleton` mientras carga. |
| `Badge` `toneDeEstado` | Estados de visita, lead, depósito, tenant. |
| `Alert` | Demo, error persistente, éxito inline. `role="alert"` en errores. |
| `Dialog` | Modales. Focus trap, Escape, `aria-modal`. Header claro, no barra púrpura. |
| `ToastProvider` `useToast` | Resultado de mutaciones. Códigos `GC-*` vía `mensajeToast`. |
| `EmptyState` | Cero filas. Icono SVG mudo + título, CTA si hay acción. |
| `Skeleton` `TableSkeleton` | Carga de tablas/KPI. |
| `PageHeader` | Título de tamaño humano. El id de spec va en `data-spec`, **nunca** como eyebrow. |
| `JornadaHeader` | Fecha + % completado del día (web visitas). Sin rail. |
| `Tabs` `TabPanel` | Secciones (`role="tab"`). Targets ≥ 44px. |
| `FilterChips` | Filtros de un valor. Scroll horizontal en móvil, no chips recortados. |
| `BrandMark` | Logo http(s) o monograma sans. |
| `Icon` | SVG inline (`currentColor`). Nav de campo, Salir, campana, check-in. |

## Campo (viewport < md) y móvil nativo

- Bottom nav: 4 destinos (Hoy, Jornada, Cartera, CRM) + overflow **Más**. Iconos
  SVG, label, indicador de activo, altura ≥ 56px.
- **Salir** siempre visible: header desktop y header (o Más) en móvil.
- Acción primaria del día (nueva visita / check-in) con icono, ≥ 52px. No un FAB
  genérico de `+`.
- Agenda tipo jornada: hora + cliente + estado + lugar. **Sin rail** de color.
- Empty states con icono mudo. Sin letra gigante ni clipart.
- Header de jornada: fecha + % + barra de progreso. Sin barra vertical de acento.

## Desktop (supervisor)

- Shell limpio: sidebar estrecho (~13rem), logo tenant, nav de texto.
- Contenido full-bleed (`PAGE` sin `max-w-6xl`).
- CRM kanban de columnas reales, no teléfono embebido.
- Tablas densas, row hover, badges secos.

## Theming multi-tenant

Fuente: `tenant.branding` (`nombre_comercial`, `color_primario`, `logo_url`).

- **Web W-10:** tab Branding en Configuración.
- **Login web:** pre-sesión `?tenant=`, localStorage y `BRANDING_DEMO`.
- **Backoffice:** acento de plataforma = ink. El color de cada empresa se edita
  en P-03 y no pinta el chrome.
- **Móvil:** `perfil.branding` tras login; default `#1D4ED8` si el JSON es inválido.

## Do / Don’t

**Do**

- Spec IDs (`W-03`, `P-05`, `M-01`) en `data-spec` o comentarios de archivo.
- `label htmlFor` / `accessibilityLabel` en controles.
- `:focus-visible` del kit; no quitar el outline.
- Empty + skeleton + toast en listados y mutaciones.
- Contraste WCAG AA sobre canvas claro (sol / calle). Light obligatorio.

**Don’t**

- Eyebrows visibles `W-xx` / `P-xx` / `M-xx`.
- Playfair, serif, crema `#F3EEE4`, pasteles de evento como marca.
- `PhoneMockup` / `BottomNav` del showcase calendar.
- Dark mode como default. Slate-on-white de template shadcn.
- Hex de marca hardcodeados en features nuevas.
- Instalar shadcn u otro kit paralelo.

## Checklist PR de UI

1. La pantalla nueva importa primitivos de `components/ui` (o el kit móvil).
2. Hay `PageHeader spec="W-xx"` o `data-spec` equivalente.
3. Empty / skeleton / toast cubren cero datos, carga y error `GC-*`.
4. El primario del tenant pinta CTA y progreso; **no** rails laterales ni tintes pastel.
5. Playwright busca `[data-spec="W-xx"]`, no el texto `W-xx`.
6. `pnpm --filter @gc/<app> typecheck` y `test` en verde.
7. Logout visible. Nav de campo con iconos SVG, no fila de texto plano.
