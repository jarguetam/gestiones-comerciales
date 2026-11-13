-- Hábitat · Fase 0 · 0.6 — Luis Martínez pasa de admin a gerente (roadmap §6)
-- Ve todas las gestiones y no aprueba. Debe ser gerente ANTES de crear a los
-- supervisores: el trigger de jerarquía exige que el jefe de un supervisor
-- sea gerente (GC-CORE-010).
-- trg_usuario_claims_refresh copia el rol nuevo a auth.users; su sesión
-- actual sigue como admin hasta que renueve el token (hasta 1 h).
-- Idempotente: si ya es gerente no hace nada.

begin;

do $$
declare
  v_t uuid;
  n int;
begin
  select id into v_t from public.tenant where codigo = 'h-bitat-para-la-humanidad-honduras';
  if v_t is null then
    raise exception 'No existe la empresa Hábitat';
  end if;

  update public.usuario
     set rol = 'gerente', jefe_id = null
   where tenant_id = v_t and nombre = 'Luis Martinez' and rol = 'admin';
  get diagnostics n = row_count;
  if n > 1 then
    raise exception 'Hay % usuarios «Luis Martinez» admin en Hábitat; se esperaba uno', n;
  end if;

  if not exists (select 1 from public.usuario where tenant_id = v_t and rol = 'admin' and activo) then
    raise exception 'Hábitat se quedaría sin administrador activo';
  end if;

  if n = 1 then
    perform public.registrar_auditoria(v_t, 'usuario', 'luis-martinez', 'update',
      jsonb_build_object('script', 'docs/ops/habitat/05-luis-gerente.sql', 'rol', 'admin → gerente'));
  end if;
end $$;

commit;
