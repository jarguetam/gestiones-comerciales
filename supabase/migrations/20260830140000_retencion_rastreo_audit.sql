-- Gate 5: retención GPS 180d + compactación anual de auditoría.
-- Columna canónica: rastreo_ubicacion.registrado_en (no capturado_en).

create table if not exists public.auditoria_resumen_anual (
  anio        integer not null,
  tenant_id   uuid,
  tabla       text not null,
  accion      text not null,
  eventos     bigint not null default 0,
  compactado_en timestamptz not null default now(),
  unique (anio, tenant_id, tabla, accion)
);

create or replace function public.purgar_rastreo_ubicacion()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.rastreo_ubicacion
   where registrado_en < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purgar_rastreo_ubicacion() from public, anon, authenticated;
grant execute on function public.purgar_rastreo_ubicacion() to service_role;

create or replace function public.compactar_auditoria_anual()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int := 0;
begin
  insert into public.auditoria_resumen_anual (anio, tenant_id, tabla, accion, eventos)
  select extract(year from creado_en)::int,
         tenant_id,
         tabla,
         accion,
         count(*)
    from public.auditoria
   where creado_en < now() - interval '365 days'
   group by 1, 2, 3, 4
  on conflict (anio, tenant_id, tabla, accion)
  do update set eventos = public.auditoria_resumen_anual.eventos + excluded.eventos,
                compactado_en = now();

  if current_setting('gc.auditoria_legal_hold', true) = 'on' then
    return 0;
  end if;

  delete from public.auditoria
   where creado_en < now() - interval '365 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.compactar_auditoria_anual() from public, anon, authenticated;
grant execute on function public.compactar_auditoria_anual() to service_role;

alter table public.auditoria_resumen_anual enable row level security;

do $$
begin
  perform cron.schedule(
    'purgar-rastreo-180d',
    '15 4 * * 0',
    'select public.purgar_rastreo_ubicacion()'
  );
exception
  when others then
    raise notice 'purgar-rastreo-180d: no se pudo programar (%). Continúa la migración.', sqlerrm;
end $$;

do $$
begin
  perform cron.schedule(
    'compactar-auditoria-anual',
    '30 4 1 1 *',
    'select public.compactar_auditoria_anual()'
  );
exception
  when others then
    raise notice 'compactar-auditoria-anual: no se pudo programar (%). Continúa la migración.', sqlerrm;
end $$;
