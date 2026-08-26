# ADR-002: Núcleo + módulos optativos por tenant

**Estado:** Aceptada · **Fecha:** 2026-08-26 · **Origen:** design D2, D10

## Contexto
El dominio común (visitas, formularios, rastreo, jerarquía) es idéntico entre rubros; lo
específico (créditos, solicitudes) solo aplica a algunos. Un retailer no debe cargar la
complejidad financiera.

## Decisión
Núcleo siempre activo; módulos optativos (`crm`, `creditos`, `solicitudes`, `depositos`,
`kilometraje`) activables por tenant en `tenant_modulo`, con RLS que verifica `modulo_activo()`.

## Consecuencias
- Las apps filtran pantallas por módulos activos (routing server-driven).
- Un módulo nuevo no toca el núcleo ni a los demás módulos.
- Los seeds de cada módulo son idempotentes y optativos.
