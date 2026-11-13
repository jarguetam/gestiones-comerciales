-- Hábitat · Fase 0 · 0.2 — Módulos: solo el núcleo
-- Apaga crm, creditos, depositos y kilometraje para Hábitat (depositos vuelve
-- con E4). Mismo efecto que admin_tenant_modulo_activar(..., false) desde el
-- backoffice; esa RPC no corre desde el editor SQL (exige sesión de plataforma).
-- La app y la web lo ven al renovar el token (hasta 1 h). Idempotente.

begin;

do $$
declare
  v_t uuid;
begin
  select id into v_t from public.tenant where codigo = 'h-bitat-para-la-humanidad-honduras';
  if v_t is null then
    raise exception 'No existe la empresa Hábitat';
  end if;

  update public.tenant_modulo tm
     set activo = false
    from public.modulo m
   where tm.modulo_id = m.id
     and tm.tenant_id = v_t
     and m.codigo in ('crm', 'creditos', 'depositos', 'kilometraje');

  if not exists (
    select 1 from public.tenant_modulo tm join public.modulo m on m.id = tm.modulo_id
     where tm.tenant_id = v_t and m.codigo = 'core' and tm.activo
  ) then
    raise exception 'El módulo core no está activo en Hábitat';
  end if;

  perform public.registrar_auditoria(v_t, 'tenant_modulo', 'habitat-fase0', 'update',
    jsonb_build_object('script', 'docs/ops/habitat/04-modulos.sql',
                       'apagados', jsonb_build_array('crm', 'creditos', 'depositos', 'kilometraje')));
end $$;

commit;
