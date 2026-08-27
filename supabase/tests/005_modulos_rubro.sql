-- ============================================================
-- F3 — Tests de módulos de rubro (pgTAP)
--   - tenant sin módulo creditos no ve cuentas
--   - deposito_confirmar rechaza asesor (GC-DEPO-001)
--   - km_registrar upsert del periodo
--   - solicitud_transicion valida flujo
--   - snapshot no escribe si el módulo está inactivo
-- ============================================================
begin;
select plan(13);

-- catálogo (por si el seed no corre con `supabase test db`)
insert into public.modulo (codigo, nombre, nucleo) values
  ('creditos',    'Créditos y cartera',  false),
  ('solicitudes', 'Solicitudes y firma', false),
  ('depositos',   'Depósitos',           false),
  ('kilometraje', 'Kilometraje',         false)
on conflict (codigo) do nothing;

-- T1 activa solicitudes/depositos/kilometraje; creditos SOLO en T1 más abajo
insert into public.tenant_modulo (tenant_id, modulo_id, activo)
select '11111111-1111-1111-1111-111111111111', m.id, true
  from public.modulo m
 where m.codigo in ('solicitudes', 'depositos', 'kilometraje')
on conflict (tenant_id, modulo_id) do update set activo = true;

-- cuentas de prueba (ingesta = postgres, bypass RLS)
insert into public.cuenta (tenant_id, persona_id, codigo_externo, monto, estado)
values
  ('22222222-2222-2222-2222-222222222222',
   (select id from public.persona where documento = 'NIT-T2-1'),
   'T2-CTA-1', 1000, 'activa'),
  ('11111111-1111-1111-1111-111111111111',
   (select id from public.persona where documento = 'NIT-T1-1'),
   'T1-CTA-1', 5000, 'activa');

-- ---------- 1. tenant sin módulo creditos no ve cuentas ----------
select tests.set_claims(
  '22222222-2222-2222-2222-222222222222', 'asesor', 'bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.cuenta),
  0,
  'tenant T2 sin módulo creditos no ve cuentas (RLS + modulo_activo)'
);

-- ---------- 2. con módulo activo el asesor ve las cuentas de SUS personas ----------
select tests.reset_claims();
insert into public.tenant_modulo (tenant_id, modulo_id, activo)
select '11111111-1111-1111-1111-111111111111', m.id, true
  from public.modulo m where m.codigo = 'creditos'
on conflict (tenant_id, modulo_id) do update set activo = true;

select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.cuenta),
  1,
  'asesor T1 con módulo creditos ve la cuenta de su persona'
);

-- ---------- 3-4. snapshot no escribe si módulo inactivo; sí escribe si activo ----------
select tests.reset_claims();
select public.snapshot_cuentas();

select is(
  (select count(*)::int from public.cuenta_saldo s
     join public.cuenta c on c.id = s.cuenta_id
    where c.codigo_externo = 'T2-CTA-1'),
  0,
  'snapshot_cuentas no escribe saldo si el módulo creditos está inactivo'
);
select ok(
  (select count(*) from public.cuenta_saldo s
     join public.cuenta c on c.id = s.cuenta_id
    where c.codigo_externo = 'T1-CTA-1') >= 1,
  'snapshot_cuentas escribe corte diario cuando el módulo creditos está activo'
);

-- ---------- 5. deposito_confirmar rechaza asesor (GC-DEPO-001) ----------
insert into public.deposito (tenant_id, asesor_id, monto, referencia, estado)
values (
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-0000-0000-0000-000000000004',
  250, 'BOLETA-1', 'pendiente'
);

select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok(
  $$select public.deposito_confirmar((select id from public.deposito where referencia='BOLETA-1'), 'confirmado')$$,
  'GC-DEPO-001: el depósito solo lo confirma un supervisor o admin',
  'deposito_confirmar rechaza al asesor (GC-DEPO-001)'
);

-- supervisor sí puede confirmar
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'supervisor', 'aaaaaaaa-0000-0000-0000-000000000003');
select lives_ok(
  $$select public.deposito_confirmar((select id from public.deposito where referencia='BOLETA-1'), 'confirmado')$$,
  'supervisor confirma el depósito pendiente'
);

-- ---------- 6-7. km_registrar upsert del periodo ----------
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');
select lives_ok(
  $$select public.km_registrar('2026-08-15', 1000, 1500)$$,
  'km_registrar inserta el periodo (normaliza al día 1)'
);
select lives_ok(
  $$select public.km_registrar('2026-08-28', 1000, 1800)$$,
  'km_registrar hace upsert del mismo periodo'
);
select is(
  (select count(*)::int from public.kilometraje
    where usuario_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and periodo = '2026-08-01'),
  1,
  'un solo registro de kilometraje por tenant/usuario/periodo'
);
select is(
  (select km_final from public.kilometraje
    where usuario_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and periodo = '2026-08-01'),
  1800::numeric,
  'el upsert actualizó km_final del periodo'
);

-- ---------- 8-10. solicitud_transicion valida flujo ----------
insert into public.solicitud (tenant_id, persona_id, asesor_id, estado_id, descripcion, monto)
values (
  '11111111-1111-1111-1111-111111111111',
  (select id from public.persona where documento = 'NIT-T1-1'),
  'aaaaaaaa-0000-0000-0000-000000000004',
  (select id from public.solicitud_estado
    where tenant_id = '11111111-1111-1111-1111-111111111111' and codigo = 'borrador'),
  'Solicitud de prueba F3',
  12000
);

select throws_ok(
  $$select public.solicitud_transicion(
      (select id from public.solicitud where descripcion = 'Solicitud de prueba F3'), 'aprobada')$$,
  'GC-SOLI-002: transición inválida borrador → aprobada',
  'solicitud_transicion rechaza saltar estados'
);

select lives_ok(
  $$select public.solicitud_transicion(
      (select id from public.solicitud where descripcion = 'Solicitud de prueba F3'), 'enviada')$$,
  'solicitud avanza borrador → enviada'
);

select throws_ok(
  $$select public.solicitud_transicion(
      (select id from public.solicitud where descripcion = 'Solicitud de prueba F3'), 'firmada')$$,
  'GC-SOLI-002: no se puede firmar sin una firma registrada',
  'pasar a firmada exige solicitud_firma'
);

select tests.reset_claims();
select * from finish();
rollback;
