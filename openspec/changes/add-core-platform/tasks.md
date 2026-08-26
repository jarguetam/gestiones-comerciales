# Tasks — add-core-platform

> Roadmap por fases (D12): cada fase es entregable y validable por separado. Este change cubre
> F0+F1; F2 y F3 se abren como changes OpenSpec propios al cerrar cada fase.

## FASE 0 — Plataforma y backoffice global (mini-proyecto 1)
- [ ] 0.1 Migración: tenant (plan, dominios), usuario_plataforma, usuario_plataforma_tenant, modulo, tenant_modulo.
- [ ] 0.2 RPCs admin_*: tenant_crear/actualizar, usuario_invitar/gestionar, modulo_activar, importar_personas (+auditoría de cada operación).
- [ ] 0.3 Claims JWT duales: `{tenant_id, rol}` para usuarios de empresa; `{plataforma:true, superadmin}` para plataforma.
- [ ] 0.4 apps/backoffice (React+Vite): P-01 login MFA, P-02 empresas (wizard de alta), P-03 detalle (branding/plan/módulos), P-04 usuarios, P-05 catálogos globales, P-06 salud.
- [ ] 0.5 Wizard de alta de empresa: rubro → branding → módulos → seed inicial → invitación del primer admin.
- [ ] 0.6 Tests: RLS de plataforma (usuario sin membresía no opera RPC admin_*), auditoría de operaciones.

## FASE 1 — Núcleo operativo (mini-proyecto 2)
- [ ] 1.1 Migración núcleo: usuario, dispositivo, zona, departamento, municipio, persona.
- [ ] 1.2 Migración visitas: actividad, subactividad, actividad_horario, visita_estado, visita.
- [ ] 1.3 Migración formularios: formulario_plantilla, formulario_respuesta.
- [ ] 1.4 Migración rastreo: rastreo_ubicacion, config_rastreo; notificaciones + auditoría.
- [ ] 1.5 Trigger `validar_jerarquia_usuario()` (asesor→supervisor→gerente, sin ciclos) + tests.
- [ ] 1.6 Funciones núcleo: subordinados(), estructura_comercial(), visitas_del_dia(), visita_checkin/checkout, dashboard_asesor/supervisor/gerente, formulario_enviar, modulo_activo.
- [ ] 1.7 RLS en 100% de tablas de negocio (patrón tenant + alcance por rol).
- [ ] 1.8 Seeds por defecto (estados visita, config rastreo, persona genérica por asesor).
- [ ] 1.9 Edge: auth-guard, rastreo-ingesta, push-notifications, notify-jobs + pg_cron.
- [ ] 1.10 Web MVP: W-01 login, W-02/02b dashboards (con drill-down), W-03 visitas, W-04 personas (CRUD+import), W-11 estructura comercial, W-14 mapa (asesores y clientes).
- [ ] 1.11 Móvil MVP: M-01 login, M-02 agenda, M-03 persona, M-04 check-in/out GPS, M-10 ajustes.
- [ ] 1.12 Tests de aislamiento por rol (pgTAP) + E2E Playwright/Detox de los MVP.

## FASE 2 — CRM leads (mini-proyecto 3)
- [ ] 2.1 Migración crm: lead, lead_estado, lead_actividad, lead_origen.
- [ ] 2.2 RPCs: lead_transicion/convertir/reasignar, crm_funnel (reglas GC-CRM-*).
- [ ] 2.3 Web: W-15 pipeline kanban, W-16 detalle (agendar visita, convertir), W-17 reporte embudo.
- [ ] 2.4 Móvil: M-11 mis leads (offline), M-12 detalle (llamar/whatsapp, agendar, convertir).
- [ ] 2.5 Tests: transiciones inválidas, conversión idempotente, duplicados por teléfono.

## FASE 3 — Módulos de rubro (mini-proyectos 4..n, por tenant)
- [ ] 3.1 creditos: producto, cuenta, cuenta_saldo, movimiento + ingesta snapshot (pg_cron).
- [ ] 3.2 solicitudes: solicitud, estado, archivo, firma + Edge pdf-solicitud.
- [ ] 3.3 depositos: deposito + deposito_confirmar + recordatorios.
- [ ] 3.4 kilometraje: kilometraje + km_registrar + recordatorio fin de mes.
- [ ] 3.5 Pantallas web/móvil de cada módulo (W-06..W-09, M-06/M-07) activables por tenant.
- [ ] 3.6 Edge importer extendido (cuentas/catálogos) + webhook-tenant (HMAC).

## Transversal (continuo)
- [ ] T.1 Design system multi-tenant + Storybook (3 brandings) — arranca en F0.
- [ ] T.2 Observabilidad: logs estructurados, dashboards por tenant, alertas.
- [ ] T.3 i18n es/en + catálogo de errores GC-*.
- [ ] T.4 Playbook de onboarding de rubro y migración Agromoney (mapa §8 spec db).
- [ ] T.5 ADRs D1–D12 en `docs/adr/`.
