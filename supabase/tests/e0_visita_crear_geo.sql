-- ============================================================
-- E0 / Task 1 — visita_crear resuelve oficina y geografía en el
-- servidor y es idempotente por p_cliente_key.
-- Autónomo: crea y revierte sus propios fixtures.
-- ============================================================
begin;
select plan(11);

-- ---------- preparación (como postgres) ----------
insert into public.departamento (nombre) values ('E0 Depto A'), ('E0 Depto B');
insert into public.municipio (departamento_id, nombre)
select d.id, case d.nombre when 'E0 Depto A' then 'E0 Muni A' else 'E0 Muni B' end
  from public.departamento d
 where d.nombre in ('E0 Depto A', 'E0 Depto B');

update public.zona z
   set departamento_id = m.departamento_id, municipio_id = m.id
  from public.municipio m
 where z.tenant_id = '11111111-1111-1111-1111-111111111111'
   and z.codigo = 'Z1'
   and m.nombre = 'E0 Muni A';

update public.usuario
   set zona_id = (select id from public.zona
                   where tenant_id = '11111111-1111-1111-1111-111111111111' and codigo = 'Z1')
 where id = 'aaaaaaaa-0000-0000-0000-000000000004';

update public.persona
   set municipio_id = (select id from public.municipio where nombre = 'E0 Muni B')
 where tenant_id = '11111111-1111-1111-1111-111111111111' and nombre = 'Finca T1';

create temp table e0_res (k text primary key, id bigint);
grant all on e0_res to authenticated;

-- ---------- caso 1: sin cliente, geografía nula (asesor A) ----------
select tests.set_claims('11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');
insert into e0_res
select 'c1', (public.visita_crear(
  p_persona_nombre => 'E0 caso 1',
  p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
  p_fecha => current_date, p_hora_inicio => '09:00'
)).id;

-- ---------- caso 2: con persona -> municipio de la persona ----------
insert into e0_res
select 'c2', (public.visita_crear(
  p_persona_nombre => 'E0 caso 2',
  p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
  p_fecha => current_date, p_hora_inicio => '10:00',
  p_persona_id => (select id from public.persona where tenant_id = '11111111-1111-1111-1111-111111111111' and nombre = 'Finca T1')
)).id;

-- ---------- caso 3: parámetros explícitos ganan ----------
insert into e0_res
select 'c3', (public.visita_crear(
  p_persona_nombre => 'E0 caso 3',
  p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_zona_id => (select id from public.zona where tenant_id = '11111111-1111-1111-1111-111111111111' and codigo = 'Z1'),
  p_departamento_id => (select id from public.departamento where nombre = 'E0 Depto A'),
  p_municipio_id => (select id from public.municipio where nombre = 'E0 Muni A'),
  p_fecha => current_date, p_hora_inicio => '11:00',
  p_persona_id => (select id from public.persona where tenant_id = '11111111-1111-1111-1111-111111111111' and nombre = 'Finca T1')
)).id;

-- ---------- caso 5/6: idempotencia (asesor A) ----------
insert into e0_res
select 'k1', (public.visita_crear(
  p_persona_nombre => 'E0 clave',
  p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
  p_fecha => current_date, p_hora_inicio => '13:00',
  p_cliente_key => 'e0e0e0e0-0000-4000-8000-000000000001'
)).id;
insert into e0_res
select 'k2', (public.visita_crear(
  p_persona_nombre => 'E0 clave',
  p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
  p_fecha => current_date, p_hora_inicio => '13:00',
  p_cliente_key => 'e0e0e0e0-0000-4000-8000-000000000001'
)).id;

-- ---------- caso 4a: asesor B sin zona -> primera zona activa ----------
select tests.set_claims('11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000005');
insert into e0_res
select 'c4', (public.visita_crear(
  p_persona_nombre => 'E0 caso 4',
  p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
  p_fecha => current_date, p_hora_inicio => '12:00'
)).id;

-- ---------- caso 7: otro usuario con la misma clave ----------
select throws_ok(
  $$select public.visita_crear(
    p_persona_nombre => 'E0 otro usuario',
    p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
    p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
    p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
    p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
    p_fecha => current_date, p_hora_inicio => '13:00',
    p_cliente_key => 'e0e0e0e0-0000-4000-8000-000000000001'
  )$$,
  'P0001',
  'GC-VIS-007: clave de cliente en uso',
  'caso 7: clave de otro usuario'
);

-- ---------- caso 8: la oficina del usuario gana sobre la primera por nombre;
-- sin geografía en ninguna parte cae al primer municipio por id ----------
select tests.reset_claims();
insert into public.zona (tenant_id, codigo, nombre)
values ('11111111-1111-1111-1111-111111111111', 'Z9E0', 'Zona 9 E0');
update public.usuario
   set zona_id = (select id from public.zona
                   where tenant_id = '11111111-1111-1111-1111-111111111111' and codigo = 'Z9E0')
 where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select tests.set_claims('11111111-1111-1111-1111-111111111111', 'supervisor', 'aaaaaaaa-0000-0000-0000-000000000003');
insert into e0_res
select 'c8', (public.visita_crear(
  p_persona_nombre => 'E0 caso 8',
  p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
  p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
  p_fecha => current_date, p_hora_inicio => '14:00'
)).id;

-- ---------- caso 9: zona del usuario inactiva -> GC-VIS-002 (sin fallback) ----------
select tests.reset_claims();
insert into public.zona (tenant_id, codigo, nombre, activo)
values ('11111111-1111-1111-1111-111111111111', 'Z8E0', 'Zona 8 E0 inactiva', false);
update public.usuario
   set zona_id = (select id from public.zona
                   where tenant_id = '11111111-1111-1111-1111-111111111111' and codigo = 'Z8E0')
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select tests.set_claims('11111111-1111-1111-1111-111111111111', 'gerente', 'aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok(
  $$select public.visita_crear(
    p_persona_nombre => 'E0 zona inactiva',
    p_actividad_id => (select id from public.actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
    p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '11111111-1111-1111-1111-111111111111'),
    p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '11111111-1111-1111-1111-111111111111'),
    p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
    p_fecha => current_date, p_hora_inicio => '15:00'
  )$$,
  'P0001',
  'GC-VIS-002: la zona no pertenece al tenant',
  'caso 9: zona inactiva del usuario no se reemplaza en silencio'
);

-- ---------- caso 4b: T2 sin zonas activas -> GC-VIS-002 ----------
select tests.reset_claims();
update public.zona set activo = false where tenant_id = '22222222-2222-2222-2222-222222222222';
select tests.set_claims('22222222-2222-2222-2222-222222222222', 'asesor', 'bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok(
  $$select public.visita_crear(
    p_persona_nombre => 'E0 sin oficina',
    p_actividad_id => (select id from public.actividad where tenant_id = '22222222-2222-2222-2222-222222222222'),
    p_sub_actividad_id => (select id from public.sub_actividad where tenant_id = '22222222-2222-2222-2222-222222222222'),
    p_actividad_hora_id => (select id from public.actividad_hora where tenant_id = '22222222-2222-2222-2222-222222222222'),
    p_zona_id => null, p_departamento_id => null, p_municipio_id => null,
    p_fecha => current_date, p_hora_inicio => '09:00'
  )$$,
  'P0001',
  'GC-VIS-002: la empresa no tiene oficinas activas',
  'caso 4b: empresa sin oficinas activas'
);

-- ---------- aserciones (como postgres) ----------
select tests.reset_claims();

select is(
  (select v.zona_id::text || '/' || v.municipio_id::text || '/' || v.departamento_id::text
     from public.visita v join e0_res r on r.id = v.id and r.k = 'c1'),
  (select z.id::text || '/' || m.id::text || '/' || m.departamento_id::text
     from public.zona z, public.municipio m
    where z.tenant_id = '11111111-1111-1111-1111-111111111111' and z.codigo = 'Z1'
      and m.nombre = 'E0 Muni A'),
  'caso 1: zona, municipio y departamento resueltos desde la oficina'
);

select is(
  (select v.zona_id::text || '/' || v.municipio_id::text || '/' || v.departamento_id::text
     from public.visita v join e0_res r on r.id = v.id and r.k = 'c2'),
  (select z.id::text || '/' || m.id::text || '/' || m.departamento_id::text
     from public.zona z, public.municipio m
    where z.tenant_id = '11111111-1111-1111-1111-111111111111' and z.codigo = 'Z1'
      and m.nombre = 'E0 Muni B'),
  'caso 2: el municipio de la persona gana sobre el de la oficina'
);

select is(
  (select v.municipio_id from public.visita v join e0_res r on r.id = v.id and r.k = 'c3'),
  (select id from public.municipio where nombre = 'E0 Muni A'),
  'caso 3: el parámetro explícito gana sobre la persona'
);

select is(
  (select v.zona_id::text || '/' || (v.departamento_id = m.departamento_id)::text
     from public.visita v
     join e0_res r on r.id = v.id and r.k = 'c4'
     join public.municipio m on m.id = v.municipio_id),
  (select z.id::text || '/true' from public.zona z
    where z.tenant_id = '11111111-1111-1111-1111-111111111111' and z.codigo = 'Z1'),
  'caso 4a: sin oficina usa la primera zona activa y departamento coherente'
);

select is(
  (select count(*)::int from public.visita
    where cliente_key = 'e0e0e0e0-0000-4000-8000-000000000001'),
  1,
  'caso 5: dos llamadas con la misma clave dejan una sola visita'
);

select is(
  (select id from e0_res where k = 'k2'),
  (select id from e0_res where k = 'k1'),
  'caso 6: la segunda llamada devuelve la misma visita'
);

select is(
  (select v.zona_id from public.visita v join e0_res r on r.id = v.id and r.k = 'c8'),
  (select id from public.zona where tenant_id = '11111111-1111-1111-1111-111111111111' and codigo = 'Z9E0'),
  'caso 8a: la zona del usuario gana sobre la primera activa por nombre'
);

select is(
  (select v.municipio_id::text || '/' || v.departamento_id::text
     from public.visita v join e0_res r on r.id = v.id and r.k = 'c8'),
  (select m.id::text || '/' || m.departamento_id::text
     from public.municipio m order by m.id limit 1),
  'caso 8b: sin geografía cae al primer municipio por id y su departamento'
);

select * from finish();
rollback;
