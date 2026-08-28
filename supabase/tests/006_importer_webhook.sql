-- ============================================================
-- F3.6 — Tests importer + webhook HMAC (pgTAP)
--   - importación de personas idempotente (upsert por documento)
--   - rechazo cross-tenant (GC-AUTH-001)
--   - cuentas sin módulo creditos (GC-IMP-020)
--   - webhook con firma inválida (GC-IMP-010) queda en cola error
--   - webhook con HMAC válido procesa persona.upsert
--   - idempotency_key no duplica el evento
-- ============================================================
begin;
select plan(12);

-- secret de prueba (no es un secreto real de producción)
update public.tenant
   set configuracion = coalesce(configuracion, '{}'::jsonb)
                    || jsonb_build_object('webhook_secret', 'test-hmac-secret-t1')
 where id = '11111111-1111-1111-1111-111111111111';

-- ---------- 1-2. admin T1 importa personas; reimportar actualiza ----------
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'admin', 'aaaaaaaa-0000-0000-0000-000000000001');

select is(
  (public.admin_importar_personas(
     '11111111-1111-1111-1111-111111111111',
     '[{"nombre":"Finca Importada","documento":"NIT-IMP-1","telefono":"555111"}]'::jsonb
   ) ->> 'insertados')::int,
  1,
  'admin T1 inserta una persona nueva'
);

select is(
  (public.admin_importar_personas(
     '11111111-1111-1111-1111-111111111111',
     '[{"nombre":"Finca Importada v2","documento":"NIT-IMP-1"}]'::jsonb
   ) ->> 'actualizados')::int,
  1,
  'reimportar el mismo documento es upsert (idempotente)'
);

select is(
  (select nombre from public.persona where documento = 'NIT-IMP-1'),
  'Finca Importada v2',
  'el upsert actualizó el nombre'
);

-- ---------- 3. asesor T2 no importa en T1 ----------
select tests.reset_claims();
select tests.set_claims(
  '22222222-2222-2222-2222-222222222222', 'asesor', 'bbbbbbbb-0000-0000-0000-000000000002');

select throws_ok(
  $$select public.admin_importar_personas(
      '11111111-1111-1111-1111-111111111111',
      '[{"nombre":"Intruso","documento":"X-1"}]'::jsonb)$$,
  'GC-AUTH-001: sin permisos para importar en este tenant',
  'asesor de otro tenant no importa en T1 (GC-AUTH-001)'
);

-- ---------- 4-5. cuentas: sin módulo rechaza; con módulo upserta ----------
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'admin', 'aaaaaaaa-0000-0000-0000-000000000001');

select throws_ok(
  $$select public.admin_importar_cuentas(
      '11111111-1111-1111-1111-111111111111',
      '[{"documento":"NIT-IMP-1","codigo_externo":"CTA-IMP-1","monto":100}]'::jsonb)$$,
  'GC-IMP-020: el módulo creditos no está activo',
  'importar cuentas sin módulo creditos falla (GC-IMP-020)'
);

select tests.reset_claims();
insert into public.modulo (codigo, nombre, nucleo) values
  ('creditos', 'Créditos y cartera', false)
on conflict (codigo) do nothing;
insert into public.tenant_modulo (tenant_id, modulo_id, activo)
select '11111111-1111-1111-1111-111111111111', m.id, true
  from public.modulo m where m.codigo = 'creditos'
on conflict (tenant_id, modulo_id) do update set activo = true;

select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'admin', 'aaaaaaaa-0000-0000-0000-000000000001');

select is(
  (public.admin_importar_cuentas(
     '11111111-1111-1111-1111-111111111111',
     '[{"documento":"NIT-IMP-1","codigo_externo":"CTA-IMP-1","monto":2500,"estado":"activa"}]'::jsonb
   ) ->> 'insertados')::int,
  1,
  'con módulo creditos se inserta la cuenta'
);

select is(
  (public.admin_importar_cuentas(
     '11111111-1111-1111-1111-111111111111',
     '[{"documento":"NIT-IMP-1","codigo_externo":"CTA-IMP-1","monto":3000}]'::jsonb
   ) ->> 'actualizados')::int,
  1,
  'reimportar cuenta por codigo_externo actualiza el monto'
);

-- ---------- 6. catálogo zona ----------
select is(
  (public.admin_importar_catalogos(
     '11111111-1111-1111-1111-111111111111',
     '[{"tipo":"zona","codigo":"Z-IMP","nombre":"Zona Importada"}]'::jsonb
   ) ->> 'insertados')::int,
  1,
  'admin importa una zona de catálogo'
);

-- ---------- 7-9. webhook HMAC ----------
select tests.reset_claims();

select is(
  (public.integracion_recibir(
     '11111111-1111-1111-1111-111111111111',
     'sifco',
     'persona.upsert',
     '{"filas":[{"nombre":"Desde Webhook","documento":"NIT-WH-1"}]}'::jsonb,
     '{"filas":[{"nombre":"Desde Webhook","documento":"NIT-WH-1"}]}',
     'firma-invalida',
     'evt-bad'
   ) ->> 'error'),
  'GC-IMP-010: firma HMAC inválida',
  'firma HMAC inválida devuelve GC-IMP-010'
);

select ok(
  exists (
    select 1 from public.integracion_evento
     where idempotency_key = 'evt-bad' and firma_ok = false and estado = 'error'
  ),
  'el evento con firma inválida queda en cola en estado error'
);

select is(
  (public.integracion_recibir(
     '11111111-1111-1111-1111-111111111111',
     'sifco',
     'persona.upsert',
     '{"filas":[{"nombre":"Desde Webhook","documento":"NIT-WH-1"}]}'::jsonb,
     '{"filas":[{"nombre":"Desde Webhook","documento":"NIT-WH-1"}]}',
     encode(hmac(convert_to('{"filas":[{"nombre":"Desde Webhook","documento":"NIT-WH-1"}]}', 'UTF8'),
                 convert_to('test-hmac-secret-t1', 'UTF8'), 'sha256'), 'hex'),
     'evt-ok'
   ) ->> 'estado'),
  'procesado',
  'HMAC válido procesa persona.upsert'
);

select ok(
  exists (select 1 from public.persona where documento = 'NIT-WH-1' and nombre = 'Desde Webhook'),
  'el webhook creó la persona'
);

select is(
  (public.integracion_recibir(
     '11111111-1111-1111-1111-111111111111',
     'sifco',
     'persona.upsert',
     '{"filas":[{"nombre":"No debe duplicar","documento":"NIT-WH-2"}]}'::jsonb,
     '{"filas":[{"nombre":"No debe duplicar","documento":"NIT-WH-2"}]}',
     encode(hmac(convert_to('{"filas":[{"nombre":"No debe duplicar","documento":"NIT-WH-2"}]}', 'UTF8'),
                 convert_to('test-hmac-secret-t1', 'UTF8'), 'sha256'), 'hex'),
     'evt-ok'
   ) ->> 'idempotente')::boolean,
  true,
  'el mismo Idempotency-Key no duplica el evento'
);

select tests.reset_claims();
select * from finish();
rollback;
