-- ============================================================
-- Gate 1 / Task 4 — BACKFILL
-- DML online: no DDL ni lock explícito de tabla.
-- El trigger EXPAND captura Vault y retira la key en la misma transacción.
-- ============================================================

select set_config('app.webhook_secret_backfill', '1', true);

-- Nombrar configuracion en SET dispara el trigger aunque el valor no cambie.
-- Solo se bloquean las filas legacy; writers de otros tenants continúan.
update public.tenant
   set configuracion = configuracion
 where configuracion ? 'webhook_secret';

select set_config('app.webhook_secret_backfill', '', true);

do $$
begin
  if exists (
    select 1
      from public.tenant
     where configuracion ? 'webhook_secret'
  ) then
    raise exception 'GC-SEC-004: backfill webhook_secret incompleto';
  end if;
end
$$;
