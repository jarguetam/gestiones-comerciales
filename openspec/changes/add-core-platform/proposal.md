# Proposal — add-core-platform

## Idioma
Todos los artefactos de este cambio se redactan en español.

## Cambio propuesto
Generalizar la plataforma Agromoney Gestiones v2 (microfinanzas agropecuarias) en una
**plataforma multi-rubro reutilizable** llamada **Gestiones Comerciales**: un solo producto
activable por tenant, con núcleo rubro-agnóstico y módulos optativos por rubro
(creditos, solicitudes, depositos, kilometraje).

## Problema
Agromoney v2 resuelve gestión de campo para un solo rubro y un solo grupo empresarial.
Venderlo/instalarlo en otros rubros (distribución, retail, seguros, farmacéuticas) exigiría
bifurcar el código: vocabulario, catálogos, formularios y reglas están embebidos (14 columnas
de precalificación, enum de estados en código, ventanas de rastreo en main.dart, registro
"CLIENTE NUEVO" hardcodeado).

## Impacto
- **Nuevo producto**: `gestiones-comerciales` (monorepo web+móvil+supabase).
- **DB**: tablas del núcleo multi-tenant + módulos optativos (`spec/db`).
- **Backend**: composición PostgREST/RPC/Edge Functions + jobs pg_cron parametrizados por tenant (`spec/backend`).
- **Frontend**: theming runtime por tenant, formularios server-driven, offline-first móvil (`spec/frontend`).
- **Jerarquía comercial**: roles `admin|gerente|supervisor|asesor` con árbol `jefe_id` (un gerente → N supervisores → N asesores) y alcance recursivo (`subordinados()`) aplicado a RLS, dashboards con drill-down y gestión de estructura.
- **Módulo CRM (nuevo)**: leads con embudo configurable por tenant (etapas como datos), pipeline kanban web (W-15/16/17) y captura móvil (M-11/12), conectado al núcleo: lead → visita → persona/solicitud.
- **Capa de plataforma (backoffice global)**: identidad `usuario_plataforma` multi-empresa, RPC administrativas `admin_*` auditadas y app `apps/backoffice` (empresas, planes, branding, módulos, usuarios, salud). El admin de empresa conserva su alcance completo en `apps/web` (clientes, usuarios, catálogos, mapa).
- **Entrega por fases (D12)**: F0 plataforma/backoffice → F1 núcleo operativo → F2 CRM → F3 módulos de rubro; cada fase es un mini-proyecto entregable.
- **Out of scope**: migración histórica de datos de otros rubros, multi-región, ERP integrations custom.

## Justificación
El 80% del dominio (visitas, formularios, rastreo, jerarquía comercial, notificaciones) es
idéntico entre rubros; solo cambia vocabulario y datos específicos. Mover lo específico a
configuración (catálogos por tenant, plantillas JSON, branding) elimina los forks.
