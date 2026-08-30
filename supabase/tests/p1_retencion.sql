begin;
select plan(6);

-- 1–2. Purga GPS: fila de 181 días desaparece; la reciente permanece.
insert into public.rastreo_ubicacion (tenant_id, usuario_id, posicion, registrado_en)
values (
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-0000-0000-0000-000000000004',
  st_setsrid(st_makepoint(-90.527, 14.634), 4326)::geography,
  now() - interval '181 days'
), (
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-0000-0000-0000-000000000004',
  st_setsrid(st_makepoint(-90.528, 14.635), 4326)::geography,
  now() - interval '10 days'
);

select ok(
  public.purgar_rastreo_ubicacion() >= 1,
  'purgar_rastreo_ubicacion elimina filas de más de 180 días'
);

select is(
  (select count(*)::int from public.rastreo_ubicacion
    where usuario_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and registrado_en > now() - interval '30 days'),
  1,
  'la traza reciente sobrevive a la purga'
);

-- 3. authenticated no puede ejecutar la purga
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');

select throws_ok(
  $$select public.purgar_rastreo_ubicacion()$$,
  '42501',
  null,
  'authenticated no ejecuta purgar_rastreo_ubicacion'
);

-- 4. compactación: evento de 400 días va al resumen y sale de auditoria
select tests.reset_claims();
insert into public.auditoria (tenant_id, tabla, registro_id, accion, usuario_id, cambios, creado_en)
values (
  '11111111-1111-1111-1111-111111111111',
  'persona',
  'old',
  'update',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '{}'::jsonb,
  now() - interval '400 days'
);

select ok(
  public.compactar_auditoria_anual() >= 1,
  'compactar_auditoria_anual mueve eventos > 365 días'
);

select is(
  (select count(*)::int from public.auditoria where registro_id = 'old'),
  0,
  'el detalle compactado ya no está en auditoria'
);

select ok(
  exists (
    select 1 from public.auditoria_resumen_anual
     where tabla = 'persona' and eventos >= 1
  ),
  'el resumen anual recibió el evento compactado'
);

select * from finish();
rollback;
