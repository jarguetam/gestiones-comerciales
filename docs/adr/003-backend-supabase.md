# ADR-003: Backend compuesto sobre Supabase

**Estado:** Aceptada · **Fecha:** 2026-08-26 · **Origen:** design D4

## Contexto
El legado (Agromoney) usaba una API .NET monolítica + Hangfire + integraciones externas
(SIFCO, Fortitoken). El costo operativo y la fricción de despliegue eran altos.

## Decisión
Backend compuesto: PostgREST (CRUD con RLS), RPC de Postgres (lógica transaccional y
validaciones), Edge Functions (efectos externos: push, mail, PDF, import, GPS), pg_cron
(jobs parametrizados por tenant). Auth nativa de Supabase con claims `tenant_id`/`rol`.

## Consecuencias
- Menor superficie operativa; cero servidores propios.
- Validaciones SIEMPRE en RPC (no en cliente).
- Errores de negocio con código GC-<MOD>-NNN mapeable a i18n.
