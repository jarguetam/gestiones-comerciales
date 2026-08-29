# Design system — Gestiones Comerciales

Tokens, primitivos y reglas de UI para `apps/web`, `apps/backoffice` y `apps/mobile`.
El kit es **propio** (no shadcn). Backoffice copia la misma API de componentes; no hay
package workspace compartido a propósito: cada app empaqueta su UI y el theming del
tenant solo vive en web/móvil.

## Tokens

Neutros **fijos** (D-UI-2). El único color que cambia por tenant es el primario.

| Token | CSS / RN | Default web | Default backoffice | Default móvil |
|---|---|---|---|---|
| canvas | `--gc-canvas` / `NEUTROS.canvas` | `#F3EEE4` | `#f8fafc` | `#F3F4F6` |
| surface | `--gc-surface` | `#FFFEF9` | `#ffffff` | `#FFFFFF` |
| line | `--gc-border` | `#E4DCC8` | `#e2e8f0` | `#E5E7EB` |
| ink | `--gc-ink` | `#1B2430` | `#0f172a` | `#111827` |
| muted | `--gc-muted` | — | `#64748b` | `#6B7280` |
| primary | `--gc-primary` | `#6D28D9` (demo) | `#0f172a` | `#1D4ED8` |

Web inyecta `varsDeBranding(tenant.branding)` sobre `:root` / el shell (`--gc-primary`,
`--gc-secondary` opcional). Móvil usa `temaDe(branding)` + `ThemeProvider`.

No uses hex sueltos en pantallas nuevas: `bg-canvas`, `border-line`, `bg-primary`,
`text-ink`, o `useTheme().primary`.

## Componentes (web / backoffice)

Importar desde `src/components/ui`.

| Componente | Cuándo usarlo |
|---|---|
| `Button` | Acciones. Variantes `primary` / `secondary` / `danger` / `ghost`. |
| `Input` `Select` `Textarea` | Campos con `htmlFor` obligatorio (`id` + `label`). |
| `Table` `THead` `Th` `TBody` `Tr` `Td` | Listados. `TableSkeleton` mientras carga. |
| `Badge` `toneDeEstado` | Estados de visita, lead, depósito, tenant. |
| `Alert` | Demo, error persistente, éxito inline. `role="alert"` en errores. |
| `Dialog` | Modales. Focus trap, Escape, `aria-modal`. |
| `ToastProvider` `useToast` | Resultado de mutaciones. Códigos `GC-*` vía `mensajeToast`. |
| `EmptyState` | Cero filas, con CTA cuando hay una acción obvia. |
| `Skeleton` `TableSkeleton` | Carga de tablas/KPI. No spinners de página completa en web. |
| `PageHeader` | Título de pantalla. El id de spec va en `data-spec`, **nunca** como eyebrow visible. |
| `Tabs` `TabPanel` | Secciones de una misma pantalla (`role="tab"`). |
| `FilterChips` | Filtros de un valor (kanban/embudo, estados). |
| `BrandMark` | Logo http(s) o monograma. |

## Componentes (móvil)

`apps/mobile/src/components/ui` + `useTheme()`:

`Card`, `Boton`, `Campo`, `BadgeEstado`, `Vacio`, `Cargando`, `Marca`, `FirmaPad`.

Header y tab bar toman el primario del tenant. Subtítulo del header:
`tintaSobrePrimario`, no `#BFDBFE`. Banner de cola pendiente = “offline” (sin
`expo-network`). Tab “Más” concentra módulos optativos para no saturar la barra.

## Theming multi-tenant

Fuente: `tenant.branding` (`nombre_comercial`, `color_primario`, `logo_url`).

- **Web W-10:** tab Branding en Configuración. Preview en vivo; persistencia
  `tenant.update` cuando hay sesión Supabase.
- **Login web:** no hay resolución de tenant por dominio pre-sesión. En DEMO se
  muestra `BRANDING_DEMO`. En vivo el branding entra al shell post-login.
- **Backoffice:** un acento de plataforma (`--gc-primary` = ink). El color de cada
  empresa se edita en P-03, no pinta el chrome del backoffice.
- **Móvil:** `perfil.branding` tras login; default `#1D4ED8` si el JSON es inválido.

## Do / Don’t

**Do**

- Spec IDs (`W-03`, `P-05`, `M-01`) en `data-spec` o comentarios de archivo.
- `label htmlFor` / `accessibilityLabel` en controles.
- `:focus-visible` del kit; no quitar el outline.
- Empty + skeleton + toast en toda pantalla de listado o mutación.

**Don’t**

- Eyebrows visibles `W-xx` / `P-xx` / `M-xx`.
- `PhoneMockup` / `BottomNav` del showcase calendar. CRM y Personas son **desktop**
  (D-UI-1): kanban de ancho completo + ficha, lista + detalle.
- Hex de marca hardcodeados (`#1D4ED8`, teal de plataforma) en features nuevas.
- Instalar shadcn u otro kit paralelo.

## Checklist PR de UI

1. La pantalla nueva importa primitivos de `components/ui` (o el kit móvil).
2. Hay `PageHeader spec="W-xx"` o `data-spec` equivalente.
3. Empty / skeleton / toast cubren cero datos, carga y error `GC-*`.
4. Contraste del primario sobre blanco: si el tenant pone un color claro, el botón
   sigue usando texto blanco; no inventar paletas extra.
5. Playwright busca `[data-spec="W-xx"]`, no el texto `W-xx`.
6. `pnpm --filter @gc/<app> typecheck` y `test` en verde.
