-- ============================================================
-- F2.5 — Tests del embudo CRM (pgTAP)
-- Reglas GC-CRM-*: transiciones inválidas, retroceso solo supervisor+,
-- perdido exige motivo, conversión idempotente, duplicados por teléfono.
-- ============================================================
begin;
select plan(12);

-- ---------- setup: embudo + leads de prueba ----------
insert into public.lead_estado (tenant_id, codigo, nombre, orden, es_ganado, es_perdido) values
  ('11111111-1111-1111-1111-111111111111', 'nuevo', 'Nuevo', 1, false, false),
  ('11111111-1111-1111-1111-111111111111', 'contactado', 'Contactado', 2, false, false),
  ('11111111-1111-1111-1111-111111111111', 'calificado', 'Calificado', 3, false, false),
  ('11111111-1111-1111-1111-111111111111', 'ganado', 'Ganado', 4, true, false),
  ('11111111-1111-1111-1111-111111111111', 'perdido', 'Perdido', 5, false, true);

insert into public.lead (tenant_id, estado_id, nombre, telefono, documento, asesor_id, monto_estimado)
values
  ('11111111-1111-1111-1111-111111111111',
   (select id from public.lead_estado where tenant_id='11111111-1111-1111-1111-111111111111' and codigo='nuevo'),
   'Lead Test A', '+502 5000-0001', 'NIT-L-A', 'aaaaaaaa-0000-0000-0000-000000000004', 50000),
  ('11111111-1111-1111-1111-111111111111',
   (select id from public.lead_estado where tenant_id='11111111-1111-1111-1111-111111111111' and codigo='nuevo'),
   'Lead Test B', '+502 5000-0002', 'NIT-L-B', 'aaaaaaaa-0000-0000-0000-000000000004', 30000);

-- ---------- 1. duplicado por teléfono (lead activo) ----------
select throws_ok(
  $$insert into public.lead (tenant_id, estado_id, nombre, telefono, asesor_id)
    select tenant_id, estado_id, 'Duplicado', '+502 5000-0001', asesor_id
    from public.lead where telefono = '+502 5000-0001'$$,
  'duplicate key value violates unique constraint "lead_tel_unico_idx"',
  'no se puede crear un lead activo con teléfono duplicado (índice único parcial)'
);

-- ---------- 2. asesor avanza su lead nuevo→contactado (válido) ----------
select tests.set_claims('11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');
select lives_ok(
  $$select public.lead_transicion(
      (select id from public.lead where telefono='+502 5000-0001'), 'contactado')$$,
  'asesor avanza su lead nuevo→contactado'
);

-- ---------- 3. asesor retrocede contactado→nuevo (inválido, requiere supervisor+) ----------
select throws_ok(
  $$select public.lead_transicion(
      (select id from public.lead where telefono='+502 5000-0001'), 'nuevo')$$,
  'GC-CRM-001: retroceder en el embudo requiere rol supervisor o superior'
);

-- ---------- 4. supervisor SÍ puede retroceder ----------
select tests.reset_claims();
select tests.set_claims('11111111-1111-1111-1111-111111111111', 'supervisor', 'aaaaaaaa-0000-0000-0000-000000000003');
select lives_ok(
  $$select public.lead_transicion(
      (select id from public.lead where telefono='+502 5000-0001'), 'nuevo')$$,
  'supervisor retrocede el lead (rol superior permitido)'
);

-- ---------- 5. perdido sin motivo → rechazado ----------
select tests.reset_claims();
select tests.set_claims('11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok(
  $$select public.lead_transicion(
      (select id from public.lead where telefono='+502 5000-0002'), 'perdido')$$,
  'GC-CRM-002: marcar el lead como perdido exige un motivo'
);

-- ---------- 6. perdido con motivo → válido y queda registrado ----------
select lives_ok(
  $$select public.lead_transicion(
      (select id from public.lead where telefono='+502 5000-0002'), 'perdido', 'sin presupuesto')$$,
  'lead marcado perdido con motivo'
);
select is(
  (select perdido_motivo from public.lead where telefono='+502 5000-0002'),
  'sin presupuesto',
  'el motivo de pérdida quedó guardado'
);

-- ---------- 7. ganado dispara conversión idempotente ----------
select lives_ok(
  $$select public.lead_transicion(
      (select id from public.lead where telefono='+502 5000-0001'), 'ganado')$$,
  'lead pasa a ganado (dispara lead_convertir)'
);
select ok(
  (select persona_id is not null from public.lead where telefono='+502 5000-0001'),
  'el lead ganado quedó con persona_id (convertido, GC-CRM-003)'
);

-- ---------- 8. conversión idempotente: re-convertir no duplica persona ----------
do $$
declare v_count_before int;
begin
  select count(*) into v_count_before from public.persona
   where tenant_id='11111111-1111-1111-1111-111111111111' and documento='NIT-L-A';
  perform public.lead_convertir((select id from public.lead where telefono='+502 5000-0001'));
  drop table if exists _conv_check;
  create temp table _conv_check as
    select v_count_before as antes,
           (select count(*) from public.persona
             where tenant_id='11111111-1111-1111-1111-111111111111' and documento='NIT-L-A') as despues;
end $$;
select is((select despues from _conv_check), (select antes from _conv_check),
  're-convertir el mismo lead no crea una segunda persona (idempotente)');

-- ---------- 9. lead convertido no retrocede (CRM-4) ----------
select throws_ok(
  $$select public.lead_transicion(
      (select id from public.lead where telefono='+502 5000-0001'), 'contactado')$$,
  'GC-CRM-004: un lead convertido no puede volver a estados previos'
);

-- ---------- 10. crm_funnel agrega por estado con alcance ----------
select ok(
  (select count(*) from public.crm_funnel(null, null)) = 5,
  'crm_funnel devuelve una fila por estado del embudo (5)'
);

select tests.reset_claims();
select * from finish();
rollback;
