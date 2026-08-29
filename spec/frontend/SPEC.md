# Spec de Frontend — Gestiones Comerciales

**Producto:** Gestiones Comerciales (plataforma genérica multi-rubro)
**Derivado de:** `spec-agromoney-v2.md` (Agromoney Gestiones v2)
**Clientes:** Web (React + Vite + TS), Móvil (React Native + Expo) y Backoffice de plataforma (React + Vite)
**Versión:** 1.0 · 2026-08-26
**Estado:** Borrador para revisión

---

## 1. Principios

| # | Principio | Aplicación |
|---|---|---|
| F-1 | **Multi-tenant en UI** | Tema visual, nombre comercial, logo y vocabulario de dominio provienen de `tenant.branding` (descargado en el boot); nunca compilados. |
| F-2 | **Un solo feature-set, módulos activables** | El routing/guard se construye desde `tenant_modulo`: un rubro sin `creditos` no ve las pantallas de cuentas. |
| F-3 | **Offline-first móvil** | La app de campo funciona sin cobertura: cola de mutaciones local + sincronización posterior (mejor esfuerzo). |
| F-4 | **Tipado extremo a extremo** | `supabase-js` con tipos generados desde el schema (`supabase gen types`) — cero interfaces manuales que se desincronicen. |
| F-5 | **UI consistente** | Design system único (tokens de tema por tenant) en web y móvil. |
| F-6 | **Accesibilidad mínima** | WCAG 2.1 AA en web (contraste, focus visible, navegación teclado). |
| F-7 | **Sin lógica de negocio** | El cliente valida formato, no reglas. Toda regla vive en RPC/Edge (spec backend §5). |

## 2. Aplicación Web (admin/supervisor)

Stack: **React 18 + TypeScript + Vite + React Router + Tailwind + kit propio**
(`apps/web/src/components/ui`; no shadcn), `@supabase/supabase-js` como único cliente HTTP.

### 2.1 Boot y sesión

1. `createBrowserClient` con anon key; sesión persistida por supabase-js.
2. `getSession` → si existe, cargar perfil (`usuario` + `tenant` + branding + módulos activos).
3. Claims del JWT (`tenant_id`, `rol`) definen alcance; el router filtra rutas por rol y módulo.
4. Refresh automático de token; en 401 → redirigir a login con redirect-back.

### 2.2 Mapa de pantallas (web)

| # | Pantalla | Rol | Módulo | Descripción |
|---|---|---|---|---|
| W-01 | Login + MFA | — | — | Email/contraseña + TOTP si el tenant exige MFA. |
| W-02 | Dashboard | sup, admin | — | KPIs del día: visitas programadas/completadas %, depósitos pendientes, asesores activos, cuentas en mora (si módulo). Fuente: `dashboard_supervisor()`. |
| W-02b | Dashboard gerencial | gerente, admin | — | Consolidado del subárbol con drill-down: selector de supervisor (y asesor) que refiltra todos los KPIs; ranking de equipos. Fuente: `dashboard_gerente()`. |
| W-03 | Visitas | sup, admin | — | Tabla con filtros (asesor, estado, fecha, zona), paginación server-side, detalle con timeline de estados y check-in/out. |
| W-04 | Personas (clientes) | sup, admin | — | CRUD con búsqueda por documento/nombre, importación CSV (Edge `importer` + RPC `admin_importar_personas`), historial por persona. |
| W-05 | Formularios | sup, admin | — | Respuestas históricas por persona/plantilla; visualización de score y resultado. |
| W-06 | Solicitudes (ex cotizaciones) | sup, admin | solicitudes | Bandeja por estado del flujo, detalle con archivos, firma y PDF. |
| W-07 | Depósitos | sup, admin | depositos | Pendientes/confirmados, confirmación en lote vía `deposito_confirmar`. |
| W-08 | Cuentas y movimientos | sup, admin | creditos | Cartera por asesor, saldo y mora por persona (`cuenta_saldo`). |
| W-09 | Kilometraje | sup, admin | kilometraje | Carga del mes por asesor, cierre de periodo. |
| W-10 | Configuración tenant | admin | — | Branding, estados de visita, catálogos (actividades/subactividades/zonas), config rastreo, plantillas de notificación, dominios CORS. |
| W-11 | Usuarios y estructura comercial | admin, gerente (lectura/asignación en su subárbol) | — | Árbol gerente→supervisor→asesor; alta de usuarios, asignación de jefe/zona/rol. |
| W-12 | Auditoría | admin | — | Log de cambios por tabla/registro con diff. |
| W-13 | Notificaciones | todos | — | Centro in-app (campana) + marcar leídas. |
| W-14 | Mapa de asesores | sup, gerente, admin | — | Última posición + recorrido del día por asesor; para gerente, filtro por supervisor/equipo (tiles OSM/Mapbox). |
| W-15 | CRM — Pipeline (funnel/kanban) | sup, gerente, admin | crm | Vista de embudo: columnas kanban por `lead_estado` (orden configurable) con tarjetas de lead; arrastrar entre etapas dispara `lead_transicion`; filtros por asesor/origen/fecha/monto. |
| W-16 | CRM — Detalle de lead | sup, gerente, admin | crm | Ficha del lead: datos, timeline (`lead_actividad`), notas/llamadas, agendar visita (crea `visita` ligada), convertir a persona (`lead_convertir`), motivo de pérdida. |
| W-17 | CRM — Reporte de embudo | sup, gerente, admin | crm | Conversión por etapa (funnel chart), tiempo promedio en etapa, leads por origen y por asesor; fuente `crm_funnel()`. |

### 2.3 Reglas de UI web

- **Formularios server-driven:** las pantallas de formularios (W-05) se renderizan desde `formulario_plantilla.esquema` con un renderer genérico (campos: texto, número, booleano, lista, fecha).
- **CRM pipeline (W-15):** las etapas del kanban se construyen desde `lead_estado` (server-driven, sin etapas compiladas); el drag&drop llama `lead_transicion` y en error `GC-CRM-*` revierte la tarjeta a su columna con toast. El kanban virtualiza columnas (los embudos pueden superar 100 tarjetas por etapa).
- **Navegación CRM→Gestiones:** desde el detalle de lead (W-16) se agenda visita (crea `visita` en estado `pendiente` ligada al lead) y al convertir (ganado) el botón lleva a la ficha de la `persona`/`solicitud` creada. El ciclo es unidireccional: lead → visita → solicitud; la ficha de persona muestra de dónde vino (origen del lead).
- **Tablas:** TanStack Table + paginación por `Range` header; filtros como query params de PostgREST (URL compartible).
- **Estado servidor:** TanStack Query con invalidación por Realtime en canales de config/catálogos.
- **Theming multi-tenant:** `ThemeProvider` aplica `tenant.branding` (colores, logo, nombre comercial) en runtime; variables `VITE_` solo para URL de Supabase.
- **i18n:** español por defecto; catálogos `locales/{es,en}/errors.json` para códigos `GC-*`.

## 3. Aplicación Móvil (asesor de campo)

Stack: **React Native + Expo + TypeScript**, React Navigation, MMKV/SQLite local, `expo-location`,
`@supabase/supabase-js`, FCM (notifee) para push.

### 2b. Backoffice de plataforma (apps/backoffice) y límites del admin de empresa

Dos niveles de administración con fronteras claras:

- **Admin de plataforma (tú, backoffice global):** opera `apps/backoffice` con usuario de
  `usuario_plataforma`. Alcance: N empresas. Crea empresas, asigna plan y branding, activa
  módulos, invita/gestiona usuarios de empresa, administra catálogos globales (departamentos,
  municipios) y ve el estado de salud de cada tenant (jobs, errores, uso). NO gestiona datos
  operativos de la empresa (visitas, leads, cuentas) salvo lectura de soporte.
- **Admin de empresa:** usa la misma web (`apps/web`) con rol `admin`. Alcance: su tenant.
  Da de alta clientes (`persona`), importa listados CSV, administra SUS usuarios y jerarquía,
  catálogos propios (actividades, subactividades, horarios, zonas, estados de visita/lead),
  config de rastreo y ve la georeferencia de asesores y clientes en el mapa (W-14).

| # | Pantalla | App | Rol | Descripción |
|---|---|---|---|---|
| P-01 | Login plataforma | backoffice | plataforma | Login dedicado (separate Supabase app), MFA obligatorio. |
| P-02 | Empresas | backoffice | plataforma | CRUD de tenants: alta con wizard (rubro, plan, branding, módulos), activar/suspender, ver salud. |
| P-03 | Empresa — detalle | backoffice | plataforma | Config de la empresa: branding, plan, dominios CORS, módulos activos, seeds, imitación de sesión (impersonación auditable para soporte). |
| P-04 | Usuarios de empresa | backoffice | plataforma | Invitar/gestionar usuarios de cualquier tenant, reset de contraseña, 2FA. |
| P-05 | Catálogos globales | backoffice | plataforma | Departamentos/municipios compartidos, catálogo de módulos, plantillas base por rubro. |
| P-06 | Salud de plataforma | backoffice | plataforma | Monitoreo: jobs pg_cron por tenant, errores de Edge Functions, uso (dispositivos, storage, notificaciones). |

> El admin de empresa NO necesita el backoffice: todo lo suyo está en W-04 (clientes),
> W-10 (config), W-11 (usuarios) y W-14 (mapa). La separación de apps evita que la UI de
> plataforma contamine la experiencia del cliente de empresa.

### 3.1 Boot y sesión

1. Login (email/contraseña) + MFA si aplica; biometría opcional para reingreso rápido.
2. Descarga de caché inicial: perfil, catálogos del tenant (actividades, estados, municipios), config rastreo, personas asignadas (mejor esfuerzo).
3. Suscripción a canal Realtime `usuario:{id}` para notificaciones.
4. Registro del token FCM (`dispositivo` upsert) tras login exitoso.

### 3.2 Flujo de campo (jornada del asesor)

```
login → toggle rastreo ON → [leads: llamar / avanzar etapa / agendar] → agenda del día →
   [visita: check-in (GPS) → formulario (si corresponde) → solicitud/firma (si módulo) →
   check-out] → fin de jornada → toggle rastreo OFF
```

- **Rastreo:** servicio foreground con `expo-location` que respeta `config_rastreo` (ventana por día, intervalo, precision_max); batch de puntos a Edge `rastreo-ingesta` (no un request por punto).
- **Check-in geocerca:** valida distancia al punto de la persona; si supera el umbral del tenant marca `fuera_de_rango=true` (no bloquea, registra).
- **Formularios offline:** guardado local (SQLite) → sincronización en background con reintentos.
- **Firma:** canvas nativo → PNG base64 → módulo `solicitudes` + Edge `pdf-solicitud`.

### 3.3 Mapa de pantallas (móvil)

| # | Pantalla | Offline | Módulo | Descripción |
|---|---|---|---|---|
| M-01 | Login + MFA + biometría | no | — | Credenciales + TOTP; biometría para sesión persistente. |
| M-02 | Home / agenda del día | parcial | — | `visitas_del_dia()` cacheada; resumen de gestión y accesos rápidos. |
| M-03 | Detalle de persona | parcial | — | Datos, categorías, historial de visitas/formularios. |
| M-04 | Detalle de visita (check-in/out) | sí | — | Botones de check-in/out con GPS, observaciones, estado. |
| M-05 | Formulario dinámico | sí | — | Renderer del esquema de `formulario_plantilla`; score en vivo si `calculo`. |
| M-06 | Solicitudes/firma | sí | solicitudes | Crear solicitud, adjuntar, firmar (canvas), ver PDF. |
| M-07 | Depósitos | parcial | depositos | Registrar depósito con foto de boleta (Storage). |
| M-08 | Notificaciones | no | — | Inbox + deep-link a visita/solicitud. |
| M-09 | Sincronización | — | — | Estado de cola local (pendientes, errores, reintentos). |
| M-10 | Perfil/ajustes | no | — | Toggle rastreo, cambiar contraseña, cerrar sesión. |
| M-11 | Mis leads | parcial | crm | Lista de leads del asesor por etapa (swipe para cambiar estado); alta rápida de lead en campo. |
| M-12 | Detalle de lead | parcial | crm | Ficha del lead con acciones: llamar/whatsapp (deep-link), nota, agendar visita, convertir. |

### 3.4 Reglas de UI móvil

- **Offline-first:** toda mutación pasa por cola local con estado `pendiente|enviado|error`; sincronizador en background con backoff exponencial.
- **Datos offline:** caché de catálogos/personas con TTL 24h + invalidación por Realtime.
- **Batería:** rastreo batch (no cada punto), JobScheduler nativo; captura solo en ventana configurada.
- **Permisos:** location "always" con justificación en UI antes del prompt del SO; foreground service en Android.
- **Deep-links:** esquema `gestiones://{tenant}/visita/{id}` manejado desde notificaciones push.

## 4. Design system multi-tenant

Tokens por tenant derivados de `tenant.branding`:

```json
{
  "nombre_comercial": "Agromoney",
  "logo_url": "https://.../logo.png",
  "color_primario": "#1D4ED8",
  "color_secundario": "#F59E0B",
  "idioma": "es"
}
```

- **Web:** tokens inyectados como CSS variables (`--gc-primary`, `--gc-canvas`, …) sobre el
  kit propio (`Button`, `Table`, `Dialog`, `Toast`, `EmptyState`, `PageHeader`, …).
  Neutros fijos; solo el primario (y logo/nombre) vienen de `tenant.branding`.
- **Backoffice:** misma API de componentes, paleta de plataforma (ink como acento), sin
  theming por empresa en el chrome.
- **Móvil:** `ThemeProvider` + primitivos RN (`Boton`, `Campo`, `Card`, `Vacio`, `FirmaPad`).
- **IDs de spec:** `data-spec="W-03"` (etc.), nunca eyebrows visibles `W-xx`/`P-xx`/`M-xx`.
- **CRM/Personas desktop (D-UI-1):** kanban y ficha a ancho completo; sin PhoneMockup.
- **Vocabulario por rubro:** `branding.vocabulario` permite renombrar entidades en UI
  (`persona` → "Cliente"/"Punto de venta"/"Asegurado") sin tocar código.
- Fallback a tokens default si el tenant no define branding completo.
  Documentación operativa: `docs/frontend/design-system.md`.

## 5. Estados, errores y feedback

- **Toast/snackbar** para resultado de mutaciones; errores mapeados por código `GC-*` (catálogo i18n).
- **Estados de carga:** skeletons en tablas (nunca spinners bloqueantes de pantalla completa).
- **Estados vacíos** con acción sugerida (ej. "No hay visitas hoy — importá tu cartera").
- **Offline badge** en móvil cuando la cola tiene pendientes.
- **Optimistic updates** solo en marcar-notificaciones-leídas y toggles (nunca en dinero/firmas).

## 6. Estructura de repositorios

```
gestiones-comerciales/
├── apps/
│   ├── backoffice/             # React + Vite (plataforma: superadmin/soporte)
│   ├── web/                    # React + Vite (empresa: admin/gerente/supervisor)
│   │   ├── src/
│   │   │   ├── app/            # router, guards (rol+módulo), providers
│   │   │   ├── features/       # 1 carpeta por pantalla (visitas, personas, ...)
│   │   │   ├── components/     # design system compartido
│   │   │   ├── lib/            # supabase client, i18n, theming, utils
│   │   │   └── types/          # generados (supabase gen types)
│   │   └── ...
│   └── mobile/                 # Expo (agente de campo)
│       ├── src/
│       │   ├── app/            # navigation + guards
│       │   ├── features/       # agenda, visita, formularios, solicitudes...
│       │   ├── services/       # rastreo, sync, storage local
│       │   └── db/             # esquema SQLite (cola offline)
│       └── ...
├── supabase/                   # migraciones, funciones, seeds (spec backend/db)
└── docs/                       # specs (este documento)
```

Monorepo con pnpm workspaces; CI separado por app (web deploy a CDN, móvil a EAS Build).

## 7. Testing

| Nivel | Herramienta | Cobertura objetivo |
|---|---|---|
| Unitario | Vitest / Jest | renderers de formularios, mappers, cola offline |
| Componente | Testing Library | pantallas críticas (W-03, M-04, M-05) |
| E2E web | Playwright | login→dashboard→visitas→filtro→detalle; backoffice: crear empresa→invitar admin→activar módulo |
| E2E móvil | Detox (smoke) | login→agenda→check-in→check-out |
| Accesibilidad | axe-core en CI | W-01..W-14 sin errores críticos |
| Visual multi-tenant | Storybook + Chromatic | mismas pantallas con 3 brandings distintos |

## 8. No funcionales (frontend)

| ID | Requisito | Objetivo |
|----|-----------|----------|
| NFR-FE-1 | Performance web | LCP < 2.5s en 4G; bundle inicial < 250 KB gzip; code-splitting por feature. |
| NFR-FE-2 | Performance móvil | arranque frío < 3s en gama media Android. |
| NFR-FE-3 | Offline | jornada completa operable sin red; 0 pérdida de datos capturados. |
| NFR-FE-4 | Compatibilidad | Chrome/Edge/Safari 2 últimas versiones; Android 8+ / iOS 15+. |
| NFR-FE-5 | Seguridad | token solo en memoria + storage seguro del SO; sin secrets en bundle. |
| NFR-FE-6 | Theming | cambio de branding sin rebuild (runtime, desde `tenant.branding`). |
| NFR-FE-7 | i18n | es por defecto, en opcional; sin textos hardcodeados en componentes. |

## 9. Mapeo legado → genérico (frontend)

| Legado Agromoney | Gestiones Comerciales | Motivo |
|---|---|---|
| Web Blazor + carpetas `components/skeleton-table copy` | React + design system único | consistencia y sin código muerto. |
| App Flutter (tracking en `main.dart`) | Expo RN + servicio de rastreo aislado | ventanas de rastreo desde `config_rastreo`, no en código. |
| "CLIENTE NUEVO" en la lista del asesor | `persona.es_registro_generico` con estilo diferenciado | era fila ficticia hardcodeada. |
| Pantalla Prequal fija (14 preguntas) | Renderer genérico de formularios | mismo componente sirve a cualquier rubro/plantilla. |
| Cotización con firma | Módulo solicitudes (M-06/W-06) | naming genérico, mismo flujo. |
| Textos y colores compilados | `tenant.branding` runtime | multi-rubro sin forks de código. |
| — (no existía CRM) | Módulo `crm`: W-15/16/17 web y M-11/12 móvil | embudo configurable conectado a visitas y solicitudes. |

## 10. Checklist de implementación frontend

1. [x] Design system con tokens multi-tenant (kit propio; sin Storybook). Ver `docs/frontend/design-system.md`.
2. [ ] Supabase client + tipos generados + interceptor de errores GC-*.
3. [ ] Web: W-01 login+MFA, W-02 dashboard, W-03 visitas (MVP admin).
4. [ ] Móvil: M-01 login, M-02 agenda, M-04 check-in/out (MVP campo).
5. [x] Renderer de formularios dinámicos (M-05) + score.
6. [ ] Cola offline + sync (móvil) con tests de pérdida de datos.
7. [ ] Servicio de rastreo con `config_rastreo` + batch.
8. [ ] Módulos: solicitudes+firma (PDF), depósitos, kilometraje, cuentas.
9. [ ] E2E Playwright + Detox en CI; axe sin errores críticos.
10. [ ] i18n es/en completo para códigos de error.
