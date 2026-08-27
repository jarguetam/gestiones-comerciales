-- Semilla de catálogos al crear empresa + normaliza rubro agromoney → agro.
-- Un tenant nuevo no debe depender de la cartera demo de AgroMoney.

create or replace function public.admin_tenant_crear(
  p_nombre text, p_rubro text, p_plan text default 'basico',
  p_branding jsonb default '{}', p_configuracion jsonb default '{}',
  p_modulos text[] default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_codigo text := lower(regexp_replace(p_nombre, '[^a-zA-Z0-9]+', '-', 'g'));
  v_rubro text := case p_rubro when 'agromoney' then 'agro' else p_rubro end;
  v_act bigint;
begin
  if not public.plataforma_puede_operar(null::uuid) and not public.es_superadmin() then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  insert into public.tenant (codigo, nombre, rubro, plan, branding, configuracion)
  values (v_codigo, p_nombre, v_rubro, p_plan, coalesce(p_branding,'{}'), coalesce(p_configuracion,'{}'))
  returning id into v_id;

  insert into public.tenant_modulo (tenant_id, modulo_id, activo)
  select v_id, m.id, true
  from public.modulo m
  where m.nucleo or (p_modulos is not null and m.codigo = any(p_modulos));

  insert into public.zona (tenant_id, codigo, nombre)
  values (v_id, 'Z1', 'Zona 1');

  insert into public.actividad (tenant_id, nombre)
  values (v_id, 'Visita comercial')
  returning id into v_act;

  insert into public.sub_actividad (tenant_id, actividad_id, nombre)
  values (v_id, v_act, 'Seguimiento');

  insert into public.actividad_hora (tenant_id, nombre, cantidad)
  values
    (v_id, '30 minutos', 0.5),
    (v_id, '1 hora', 1.0),
    (v_id, '2 horas', 2.0);

  perform public.registrar_auditoria(v_id, 'tenant', v_id::text, 'insert',
    jsonb_build_object('nombre', p_nombre, 'rubro', v_rubro, 'plan', p_plan));

  return v_id;
end;
$$;

grant execute on function public.admin_tenant_crear(text,text,text,jsonb,jsonb,text[]) to authenticated;
