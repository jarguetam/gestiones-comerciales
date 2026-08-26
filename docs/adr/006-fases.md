# ADR-006: Entrega por fases (mini-proyectos)

**Estado:** Aceptada · **Fecha:** 2026-08-26 · **Origen:** design D12

## Contexto
El alcance total (plataforma + núcleo + CRM + 4 módulos de rubro) es grande. Un big-bang
integraría tarde y validaría tarde.

## Decisión
Fases entregables por dependencia:
- **F0** Plataforma + backoffice (empresas, usuarios, módulos) — este repo arranca aquí.
- **F1** Núcleo operativo (personas, visitas, rastreo, web+móvil MVP).
- **F2** CRM leads (pipeline, conversión).
- **F3** Módulos de rubro (creditos, solicitudes, depositos, kilometraje) por tenant.

Cada fase es un change OpenSpec independiente.

## Consecuencias
- F0 ya entrega valor (onboarding de empresas).
- Cada fase reutiliza la anterior sin re-trabajo (dependencias en el núcleo).
- Los módulos F3 pueden priorizarse por rubro del cliente.
