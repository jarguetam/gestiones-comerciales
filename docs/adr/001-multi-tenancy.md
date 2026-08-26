# ADR-001: Multi-tenancy con tenant_id + RLS

**Estado:** Aceptada · **Fecha:** 2026-08-26 · **Origen:** design D1

## Contexto
La plataforma servirá a N empresas de distintos rubros. Se requiere aislamiento total de datos
con un solo despliegue y una sola cadena de migraciones.

## Decisión
Una base única, `tenant_id` en toda tabla de negocio, aislamiento por RLS usando claims del JWT
(`tenant_id`, `rol`). Ninguna política confía en parámetros del cliente.

## Alternativas
- Base por tenant: operación costosa (N backups, N migraciones).
- Schema por tenant: PostgREST lo expone mal; complejidad en cada query.

## Consecuencias
- Una migración sirve a todos los tenants.
- Riesgo de fuga cross-tenant mitigado con tests pgTAP tabla × rol × tenant ajeno.
- El `tenant_id` se establece una sola vez (claims), no viaja en el payload.
