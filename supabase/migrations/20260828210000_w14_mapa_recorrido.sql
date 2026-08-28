-- W-14: lecturas de rastreo con lat/lng planas para el mapa de asesores.
-- PostgREST serializa geography como GeoJSON; esta RPC evita ambigüedad y
-- filtra por día en zona America/Guatemala. RLS de rastreo_ubicacion aplica
-- (security invoker): el asesor no ve al resto; supervisor/gerente su subárbol.

create or replace function public.mapa_recorrido(
  p_fecha date default (timezone('America/Guatemala', now()))::date,
  p_supervisor_id uuid default null
)
returns table (
  usuario_id uuid,
  nombre text,
  rol text,
  jefe_id uuid,
  lat double precision,
  lng double precision,
  precision_m numeric,
  registrado_en timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.usuario_id,
    u.nombre,
    u.rol,
    u.jefe_id,
    st_y(r.posicion::geometry) as lat,
    st_x(r.posicion::geometry) as lng,
    r.precision_m,
    r.registrado_en
  from public.rastreo_ubicacion r
  join public.usuario u on u.id = r.usuario_id
  where (r.registrado_en at time zone 'America/Guatemala')::date = p_fecha
    and (
      p_supervisor_id is null
      or u.id = p_supervisor_id
      or u.jefe_id = p_supervisor_id
    )
  order by r.registrado_en;
$$;

grant execute on function public.mapa_recorrido(date, uuid) to authenticated;
