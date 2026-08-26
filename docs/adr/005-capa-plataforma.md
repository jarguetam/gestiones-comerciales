# ADR-005: Capa de plataforma (backoffice global)

**Estado:** Aceptada · **Fecha:** 2026-08-26 · **Origen:** design D11

## Contexto
El administrador global del producto debe crear empresas, asignar planes/módulos y gestionar
usuarios de cualquier tenant — sin que eso implique acceso a datos operativos ni contaminación
de la experiencia del cliente de empresa.

## Decisión
Identidad separada `usuario_plataforma` (+ `usuario_plataforma_tenant` para alcance) con app
dedicada `apps/backoffice`. Los usuarios de plataforma operan SOLO vía RPC `admin_*`
`security definer` que verifican membresía y auditan cada operación. La RLS de negocio nunca
se relaja: un JWT de plataforma no tiene `tenant_id` y por tanto no puede leer tablas de
negocio vía PostgREST.

## Consecuencias
- Frontera plataforma/empresa explícita y auditable (tabla `auditoria`).
- Soporte a empresas sin riesgo de contaminación de datos.
- Impersonación de soporte (P-03) queda registrada siempre.
