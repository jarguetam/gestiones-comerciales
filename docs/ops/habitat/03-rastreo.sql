-- Hábitat · Fase 0 · 0.5 — Horario de rastreo (config_rastreo)
-- Propuesta del roadmap mientras Luis confirma la jornada:
-- lunes a viernes 07:30–17:30, sábado 07:30–12:30, domingo sin rastreo,
-- cada 20 minutos, precisión máxima 100 m. dia_semana: 0 = domingo.
-- La app lee la fila del día (getDay() del teléfono); sin fila no rastrea.
-- Idempotente.

begin;

do $$
declare
  v_t uuid;
begin
  select id into v_t from public.tenant where codigo = 'h-bitat-para-la-humanidad-honduras';
  if v_t is null then
    raise exception 'No existe la empresa Hábitat';
  end if;

  insert into public.config_rastreo (tenant_id, dia_semana, hora_inicio, hora_fin, intervalo_min, precision_max_m)
  select v_t, r.dia, r.ini::time, r.fin::time, 20, 100
    from (values (1, '07:30', '17:30'), (2, '07:30', '17:30'), (3, '07:30', '17:30'),
                 (4, '07:30', '17:30'), (5, '07:30', '17:30'), (6, '07:30', '12:30'))
      as r(dia, ini, fin)
  on conflict (tenant_id, dia_semana) do update
    set hora_inicio = excluded.hora_inicio,
        hora_fin = excluded.hora_fin,
        intervalo_min = excluded.intervalo_min,
        precision_max_m = excluded.precision_max_m;

  perform public.registrar_auditoria(v_t, 'config_rastreo', 'habitat-fase0', 'update',
    jsonb_build_object('script', 'docs/ops/habitat/03-rastreo.sql', 'dias', 6));
end $$;

commit;
