-- Gate 5 Task 6: stats de brute-force sobre auth_evento (Gate 1).

create or replace view public.auth_evento_stats as
select
  coalesce(host(ip), 'unknown') as ip,
  count(*)::int as intentos,
  date_trunc('minute', creado_en) as ventana
from public.auth_evento
where outcome in ('fail', 'blocked')
  and creado_en > now() - interval '10 minutes'
group by 1, 3;

revoke all on public.auth_evento_stats from public, anon, authenticated;
grant select on public.auth_evento_stats to service_role;
