-- Gate 5 Task 6: stats de brute-force sobre auth_attempts (main).
-- Cuando Gate 1 mergee auth_evento, esta vista se puede reescribir sobre esa tabla.

create or replace view public.auth_evento_stats as
select
  coalesce(ip, 'unknown') as ip,
  count(*)::int as intentos,
  date_trunc('minute', creado_en) as ventana
from public.auth_attempts
where exitoso = false
  and creado_en > now() - interval '10 minutes'
group by 1, 3;

revoke all on public.auth_evento_stats from public, anon, authenticated;
grant select on public.auth_evento_stats to service_role;
