-- ============================================================
-- Gate 1 / Task 4 — VALIDATE
-- La migración anterior ya confirmó el CHECK NOT VALID.
-- Este scan usa el lock de VALIDATE, compatible con writes normales.
-- ============================================================

alter table public.tenant
  validate constraint tenant_configuracion_sin_webhook_secret;

-- El trigger permanente queda como defensa si el constraint se deshabilita
-- durante una futura operación; su función no es invocable por roles API.
comment on trigger capture_tenant_webhook_secret on public.tenant is
  'Guard de compatibilidad y defensa para impedir secretos públicos; la función privada no tiene EXECUTE API.';

notify pgrst, 'reload schema';
