-- RLS y claims duales: un usuario puede ser admin de empresa y superadmin de plataforma.
-- El alta del usuario concreto se hace fuera de migraciones (datos de entorno).

drop policy if exists tenant_select_plataforma on public.tenant;
create policy tenant_select_plataforma on public.tenant
  for select to authenticated
  using (
    public.es_superadmin()
    or exists (
      select 1 from public.usuario_plataforma_tenant upt
      where upt.usuario_plataforma_id = auth.uid()
        and upt.tenant_id = tenant.id
    )
  );

drop policy if exists tenant_modulo_select_plataforma on public.tenant_modulo;
create policy tenant_modulo_select_plataforma on public.tenant_modulo
  for select to authenticated
  using (
    public.es_superadmin()
    or exists (
      select 1 from public.usuario_plataforma_tenant upt
      where upt.usuario_plataforma_id = auth.uid()
        and upt.tenant_id = tenant_modulo.tenant_id
    )
  );

create or replace function public.usuario_claims_refresh()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_meta jsonb;
  v_plat public.usuario_plataforma%rowtype;
begin
  v_meta := coalesce(
    (select raw_app_meta_data from auth.users where id = new.id),
    '{}'::jsonb
  ) - 'plataforma' - 'superadmin'
    || jsonb_build_object('tenant_id', new.tenant_id, 'rol', new.rol);

  select * into v_plat from public.usuario_plataforma where id = new.id and activo;
  if v_plat.id is not null then
    v_meta := v_meta || jsonb_build_object(
      'plataforma', true,
      'superadmin', v_plat.es_superadmin
    );
  end if;

  update auth.users set raw_app_meta_data = v_meta where id = new.id;
  return new;
end;
$$;

create or replace function public.sync_auth_user_claims()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_usuario public.usuario%rowtype;
  v_plataforma public.usuario_plataforma%rowtype;
  v_metadata jsonb := '{}'::jsonb;
begin
  select * into v_usuario from public.usuario where id = new.id;
  select * into v_plataforma from public.usuario_plataforma where id = new.id and activo;

  if v_usuario.id is not null then
    v_metadata := v_metadata || jsonb_build_object('tenant_id', v_usuario.tenant_id, 'rol', v_usuario.rol);
  end if;
  if v_plataforma.id is not null then
    v_metadata := v_metadata || jsonb_build_object(
      'plataforma', true,
      'superadmin', v_plataforma.es_superadmin
    );
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || v_metadata
  where id = new.id;

  return new;
end;
$$;
