-- Probe de PostgREST: `rpc/now` no existe y su 404 pasaba como sano.
create or replace function public.salud_ping()
returns boolean
language sql
stable
as $$ select true $$;

revoke execute on function public.salud_ping() from public;
grant execute on function public.salud_ping() to anon, authenticated;
