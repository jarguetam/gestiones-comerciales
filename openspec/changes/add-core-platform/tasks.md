# Tasks — add-core-platform

> Roadmap por fases (D12): cada fase es entregable y validable por separado. Este change cubre
> F0+F1; F2 y F3 se abren como changes OpenSpec propios al cerrar cada fase.

## FASE 0 — Plataforma y backoffice global (mini-proyecto 1)
- [x] 0.1 Migración: tenant (plan, dominios), usuario_plataforma, usuario_plataforma_tenant, modulo, tenant_modulo.
- [x] 0.2 RPCs admin_*: tenant_crear/actualizar, usuario_invitar/gestionar, modulo_activar, importar_personas (+auditoría de cada operación). *(las 6 aplicadas; importar_personas con guard to_regclas
