# ADR-004: Jerarquía comercial de 4 roles

**Estado:** Aceptada · **Fecha:** 2026-08-26 · **Origen:** design D9

## Contexto
La operación exige: asesor (campo), supervisor (equipo), gerente (red de supervisores) y admin
(tenant). Un gerente debe ver resultados de todos sus asesores indirectos.

## Decisión
`usuario.rol ∈ {admin, gerente, supervisor, asesor}` con jerarquía auto-referida `jefe_id`
(asesor→supervisor→gerente). Un CTE recursivo (`subordinados()`) resuelve el subárbol y
alimenta RLS, dashboards con drill-down y `estructura_comercial()`. Trigger
`validar_jerarquia_usuario()` rechaza ciclos y saltos de nivel (GC-CORE-010).

## Alternativas
- Tablas intermedias por nivel: rígido, N joins.
- Closure table: overkill para 3 niveles.

## Consecuencias
- Un solo mecanismo de alcance para RLS, reporting y UI.
- Agregar un 5º nivel solo cambia el check del trigger.
