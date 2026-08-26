# Design — add-core-platform

## Contexto
Se parte del spec técnico de Agromoney v2 (`spec-agromoney-v2.md`, 1683 líneas): una app de
gestión de campo sobre Supabase que reemplaza una API .NET + SIFCO + Fortitoken. El objetivo
del cambio es que esa misma plataforma sirva a N rubros sin tocar código.

## Metas y no-metas
**Metas:** multi-tenancy estricto; núcleo + módulos; configuración sobre código; theming runtime;
formularios dinámicos; offline-first móvil.
**No-metas:** multi-región; soporte multi-idioma completo (solo es/en); integraciones ERP custom por rubro.

## Decisiones

### D1. Multi-tenancy con `tenant_id` + RLS (no schema-per-tenant)
- **Decisión:** una base única, `tenant_id` en toda tabla de negocio, aislamiento por RLS usando claims del JWT.
- **Alternativas:** base por tenant (operación costosa, N migraciones); schema por tenant (PostgREST lo expone mal).
- **Consecuencias:** una migración sirve a todos; riesgo de fuga cross-tenant se mitiga con tests de aislamiento por rol (NFR-DB-1).

### D2. Núcleo + módulos optativos (`tenant_modulo`)
- **Decisión:** tablas de núcleo siempre presentes; módulos (creditos, solicitudes, depositos, kilometraje) se activan por tenant y su RLS verifica `modulo_activo()`.
- **Alternativas:** todo en el núcleo (client financiero pesa a un retailer); microservicios por módulo (overkill).
- **Consecuencias:** un retailer no ve tablas financieras; el módulo creditos concentra lo específico de microfinanzas (ex SIFCO).

### D3. Formularios dinámicos JSONB en lugar de columnas fijas
- **Decisión:** `formulario_plantilla.esquema` (JSON Schema suavizado) + `formulario_respuesta.respuestas` JSONB validado server-side; scoring por `plantilla.calculo`.
- **Alternativas:** columnas fijas (como `Prequal` de 14 ints — cada cambio era ALTER+release); EAV clásico.
- **Consecuencias:** el renderer del frontend es único y server-driven; la validación usa jsonschema en RPC.

### D4. Backend compuesto: PostgREST + RPC + Edge Functions (sin API .NET)
- **Decisión:** CRUD directo con RLS; lógica transaccional en funciones Postgres; efectos externos en Edge Functions (push, mail, PDF, import, ingesta GPS).
- **Alternativas:** reescribir la API .NET (costo, ops); BaaS puro sin RPC (validaciones al cliente).
- **Consecuencias:** menos superficie operativa; contratos explícitos por tipo de endpoint (spec backend §4).

### D5. Jobs pg_cron + `notify-jobs` parametrizados por tenant
- **Decisión:** una corrida genérica selecciona tenants activos y aplica su config (ventanas, módulos), reemplazando los 9 jobs globales de Hangfire.
- **Alternativas:** un cron por tenant (N× jobs); mantener Hangfire.
- **Consecuencias:** el "último día del mes" se implementa con corrida diaria + guarda (pg_cron no soporta `L`/`?`).

### D6. Theming y vocabulario runtime desde `tenant.branding`
- **Decisión:** logo, colores, nombre comercial y vocabulario de entidades ("Cliente"/"Punto de venta") se leen en el boot y se aplican como tokens; sin rebuild.
- **Alternativas:** builds por cliente (forks); CSS estático.
- **Consecuencias:** un solo deploy sirve a todos los rubros; el design system define fallbacks.

### D7. Offline-first móvil con cola local
- **Decisión:** SQLite local con estados pendiente/enviado/error y sincronizador con backoff; rastreo en batch respetando `config_rastreo`.
- **Alternativas:** solo-online (el campo real no tiene cobertura estable); sincronización manual.
- **Consecuencias:** la jornada es operable sin red; complejidad en el sync (tests de pérdida de datos obligatorios).

### D8. Persona genérica con `documento` + `detalles jsonb`
- **Decisión:** `persona` unifica cliente/prospecto/punto de venta; tipo de documento configurable; atributos de rubro en `detalles` validados por esquema del tenant.
- **Alternativas:** tabla por rol de persona; columnas específicas de agro.
- **Consecuencias:** el registro ficticio "CLIENTE NUEVO" pasa a ser `persona.es_registro_generico=true` (seed por asesor), nunca una fila inventada en memoria.

### D9. Jerarquía comercial de 4 roles con árbol recursivo
- **Decisión:** roles `admin|gerente|supervisor|asesor` en `usuario.rol`; jerarquía con auto-referencia `jefe_id` (asesor→supervisor→gerente); un CTE recursivo (`subordinados()`) resuelve el subárbol y alimenta RLS, dashboards con drill-down y la vista de estructura comercial. Trigger DB valida la cadena y ciclos.
- **Alternativas:** niveles fijos con tablas intermedias por nivel (rígido); closure table (overkill para 3 niveles); ACL genérica (complejidad innecesaria).
- **Consecuencias:** un solo mecanismo de alcance para RLS, reporting y UI; agregar un 5º nivel (ej. coordinador) solo cambia el check del trigger, no el patrón; el costo del recursivo se mitiga con índice sobre `jefe_id` y árboles poco profundos (≤4).

### D10. Módulo CRM de leads con embudo configurable conectado al núcleo
- **Decisión:** módulo optativo `crm` con etapas como datos (`lead_estado` con `orden`, `es_ganado`, `es_perdido`), historial en `lead_actividad` y reglas de transición en RPC (`lead_transicion`). Conexión con el núcleo: agendar visita desde el lead y conversión ganado→`persona` (+`solicitud` si activa) idempotente.
- **Alternativas:** pipeline compilado con etapas fijas (mismo problema que las 14 columnas de Prequal); CRM externo (Salesforce/HubSpot) sincronizado (costo, latencia, offline imposible); leads como `persona` con flag (contamina el maestro de personas con no-clientes).
- **Consecuencias:** embudo distinto por rubro sin código; el asesor trabaja leads offline en móvil; el maestro `persona` queda limpio (solo convertidos); duplicados controlados por índice único parciales (telefono mientras no convertido).

### D11. Capa de plataforma (backoffice global) separada del admin de empresa
- **Decisión:** nuevo scope de identidad `usuario_plataforma` (+ `usuario_plataforma_tenant` para alcance multi-empresa) por encima de los tenants, con app dedicada (`apps/backoffice`). Los usuarios de plataforma operan SOLO vía RPC administrativas `security definer` (`admin_tenant_*`, `admin_usuario_*`, `admin_modulo_*`) que verifican membresía y auditan; nunca se relaja la RLS de negocio. El admin de empresa mantiene todo su alcance dentro de `apps/web` (W-04/10/11/14).
- **Alternativas:** un solo rol 'superadmin' dentro de cada tenant (riesgo de fuga de frontera, UI contaminada); backoffice con acceso directo service_role sin RPC (sin auditoría ni control granular); third-party admin (Retool) sin theming ni control de permisos.
- **Consecuencias:** la frontera plataforma/empresa queda explícita y auditable; agregar más funciones de soporte (impersonación, export) es extender RPC admin_*; el costo es una app más en el monorepo (comparte design system y tipos).

### D12. Entrega por fases (mini-proyectos por módulo)
- **Decisión:** partir el roadmap en 4 fases ordenadas por dependencia: F0 plataforma+backoffice (empresas, usuarios, módulos), F1 núcleo operativo (personas, visitas, rastreo, web+móvil MVP), F2 CRM leads, F3 módulos de rubro (creditos, solicitudes, depositos, kilometraje). Cada fase es un change OpenSpec independiente con proposal/design/tasks propios.
- **Alternativas:** big-bang (riesgo alto, feedback tardío); fases por capas técnicas (DB→backend→frontend: integra tarde y valida tarde).
- **Consecuencias:** valor entregable por fase (F0 ya permite operar el onboarding de empresas); cada fase reutiliza la anterior sin re-trabajo porque las dependencias están en el núcleo (G-1/G-2).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Fuga cross-tenant por política mal escrita | Tests automatizados tabla × rol; revisión de RLS en PR con checklist. |
| JSONB sin validación → datos basura | Constraints `jsonb matches_schema` + validación en RPC. |
| Complejidad del sync offline | Estados explícitos + E2E de pérdida de datos; feature flag de rollout. |
| Abuso del `detalles jsonb` como cajón | Revisión de esquema por rubro en onboarding; módulos para dominios grandes. |
| Deriva de tipos cliente/servidor | `supabase gen types` en CI (falla si migración no regenera tipos). |

## Archivos afectados
- `spec/db/SPEC.md` — modelo de datos, RLS, jobs, migración.
- `spec/backend/SPEC.md` — API, Edge Functions, matriz de permisos, NFRs.
- `spec/frontend/SPEC.md` — pantallas, design system, offline, testing.
