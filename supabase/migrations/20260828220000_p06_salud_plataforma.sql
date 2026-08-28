-- ============================================================
-- P-06 — Salud de plataforma
--   - edge_invocacion: log de Edge Functions (ok / error, duración)
--   - RPC admin_salud_plataforma: jobs pg_cron + uso por tenant
--     (dispositivos, notificaciones 24h, storage, errores)
-- Lectura: cualquier usuario_plataforma activo (incluye rol lectura).
-- Escritura de invocaciones: service_role (Edge).
-- ============================================================

create table public.edge_invocacion (
  id           bigint generated always as identity primary key,
  tenant_id    uuid references public.tenant(id) on delete cascade,
  funcion      text not null,
  duracion_ms  integer,
  ok           boolean not null default true,
  error        text,
  creado_en    timestamptz not null default now()
);

create index on public.edge_invocacion (creado_en desc);
create index on public.edge_invocacion (tenant_id, creado_en desc);

alter table public.edge_invocacion enable row level security;

-- Sin policies para authenticated: solo service_role (bypass) y RPC definer.
revoke all on public.edge_invocacion from public;
grant insert on public.edge_invocacion to service_role;

create or replace function public.registrar_edge_invocacion(
  p_funcion text,
  p_ok boolean,
  p_error text default null,
  p_duracion_ms integer default null,
  p_tenant_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_funcion is null or length(trim(p_funcion)) = 0 then
    raise exception 'GC-JOBS-001: funcion requerida';
  end if;
  insert into public.edge_invocacion (tenant_id, funcion, duracion_ms, ok, error)
  values (p_tenant_id, trim(p_funcion), p_duracion_ms, coalesce(p_ok, false), p_error)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.registrar_edge_invocacion(text, boolean, text, integer, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.registrar_edge_invocacion(text, boolean, text, integer, uuid) to service_role';
  end if;
end $$;

create or replace function public.admin_salud_jobs_catalogo()
returns jsonb
language sql
stable
as $$
  select jsonb_agg(jsonb_build_object(
           'nombre', e.nombre,
           'schedule', e.schedule_esperado,
           'activo', false,
           'programado', false,
           'ultima_corrida', null,
           'ultimo_estado', null
         ) order by e.nombre)
    from (
      values
        ('notify-jobs-recordatorio-agenda', '30 12 * * *'),
        ('snapshot-cuentas', '30 0 * * *'),
        ('recordatorio-depositos', '30 14,21 * * 1-5'),
        ('recordatorio-kilometraje', '0 14,23 * * *')
    ) as e(nombre, schedule_esperado);
$$;

create or replace function public.admin_salud_jobs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if to_regclass('cron.job') is null then
    return public.admin_salud_jobs_catalogo();
  end if;

  if to_regclass('cron.job_run_details') is not null then
    select coalesce(jsonb_agg(x.obj order by x.nombre), '[]'::jsonb)
      into v
    from (
      select jsonb_build_object(
               'nombre', e.nombre,
               'schedule', coalesce(j.schedule, e.schedule_esperado),
               'activo', coalesce(j.active, false),
               'programado', (j.jobid is not null),
               'ultima_corrida', r.start_time,
               'ultimo_estado', r.status
             ) as obj,
             e.nombre
        from (
          values
            ('notify-jobs-recordatorio-agenda', '30 12 * * *'),
            ('snapshot-cuentas', '30 0 * * *'),
            ('recordatorio-depositos', '30 14,21 * * 1-5'),
            ('recordatorio-kilometraje', '0 14,23 * * *')
        ) as e(nombre, schedule_esperado)
        left join cron.job j on j.jobname = e.nombre
        left join lateral (
          select d.status::text, d.start_time
            from cron.job_run_details d
           where d.jobid = j.jobid
           order by d.start_time desc nulls last
           limit 1
        ) r on true
      union all
      select jsonb_build_object(
               'nombre', j.jobname,
               'schedule', j.schedule,
               'activo', j.active,
               'programado', true,
               'ultima_corrida', r.start_time,
               'ultimo_estado', r.status
             ),
             j.jobname
        from cron.job j
        left join lateral (
          select d.status::text, d.start_time
            from cron.job_run_details d
           where d.jobid = j.jobid
           order by d.start_time desc nulls last
           limit 1
        ) r on true
       where j.jobname not in (
         'notify-jobs-recordatorio-agenda',
         'snapshot-cuentas',
         'recordatorio-depositos',
         'recordatorio-kilometraje'
       )
    ) x;
  else
    select coalesce(jsonb_agg(x.obj order by x.nombre), '[]'::jsonb)
      into v
    from (
      select jsonb_build_object(
               'nombre', e.nombre,
               'schedule', coalesce(j.schedule, e.schedule_esperado),
               'activo', coalesce(j.active, false),
               'programado', (j.jobid is not null),
               'ultima_corrida', null,
               'ultimo_estado', null
             ) as obj,
             e.nombre
        from (
          values
            ('notify-jobs-recordatorio-agenda', '30 12 * * *'),
            ('snapshot-cuentas', '30 0 * * *'),
            ('recordatorio-depositos', '30 14,21 * * 1-5'),
            ('recordatorio-kilometraje', '0 14,23 * * *')
        ) as e(nombre, schedule_esperado)
        left join cron.job j on j.jobname = e.nombre
      union all
      select jsonb_build_object(
               'nombre', j.jobname,
               'schedule', j.schedule,
               'activo', j.active,
               'programado', true,
               'ultima_corrida', null,
               'ultimo_estado', null
             ),
             j.jobname
        from cron.job j
       where j.jobname not in (
         'notify-jobs-recordatorio-agenda',
         'snapshot-cuentas',
         'recordatorio-depositos',
         'recordatorio-kilometraje'
       )
    ) x;
  end if;

  return coalesce(v, public.admin_salud_jobs_catalogo());
end;
$$;

revoke all on function public.admin_salud_jobs_catalogo() from public;
revoke all on function public.admin_salud_jobs() from public;

create or replace function public.admin_salud_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jobs jsonb := '[]'::jsonb;
  v_tenants jsonb := '[]'::jsonb;
  v_storage jsonb := '{}'::jsonb;
begin
  if not public.es_usuario_plataforma() then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  begin
    v_jobs := public.admin_salud_jobs();
  exception
    when undefined_table or undefined_object then
      v_jobs := public.admin_salud_jobs_catalogo();
  end;

  begin
    if to_regclass('storage.objects') is not null then
      select coalesce(jsonb_object_agg(tenant_key, bytes), '{}'::jsonb)
        into v_storage
      from (
        select split_part(o.name, '/', 1) as tenant_key,
               coalesce(sum(coalesce((o.metadata->>'size')::bigint, 0)), 0) as bytes
          from storage.objects o
         group by 1
      ) s;
    end if;
  exception
    when undefined_table or undefined_column then
      v_storage := '{}'::jsonb;
  end;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.nombre), '[]'::jsonb)
    into v_tenants
  from (
    select
      te.id,
      te.codigo,
      te.nombre,
      te.activo,
      coalesce((
        select count(*)::int
          from public.dispositivo d
          join public.usuario u on u.id = d.usuario_id
         where u.tenant_id = te.id and d.activo
      ), 0) as dispositivos_activos,
      coalesce((
        select count(*)::int
          from public.notificacion n
         where n.tenant_id = te.id
           and n.creado_en >= now() - interval '24 hours'
      ), 0) as notificaciones_24h,
      coalesce((v_storage ->> te.id::text)::bigint, 0) as storage_bytes,
      coalesce((
        select count(*)::int
          from public.edge_invocacion e
         where e.tenant_id = te.id
           and e.ok is false
           and e.creado_en >= now() - interval '24 hours'
      ), 0) as errores_edge_24h,
      coalesce((
        select count(*)::int
          from public.integracion_evento ie
         where ie.tenant_id = te.id
           and ie.estado = 'error'
           and ie.creado_en >= now() - interval '24 hours'
      ), 0) as errores_integracion_24h
    from public.tenant te
    where public.es_superadmin()
       or exists (
         select 1
           from public.usuario_plataforma_tenant upt
          where upt.usuario_plataforma_id = auth.uid()
            and upt.tenant_id = te.id
       )
  ) t;

  return jsonb_build_object(
    'generado_en', now(),
    'jobs', coalesce(v_jobs, '[]'::jsonb),
    'tenants', coalesce(v_tenants, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_salud_plataforma() from public;
grant execute on function public.admin_salud_plataforma() to authenticated;
