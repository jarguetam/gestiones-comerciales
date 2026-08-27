-- ============================================================
-- F1.12 — Tests de aislamiento por tenant y por rol (pgTAP)
-- Cubre las reglas GC-RLS-* del spec sobre persona/visita/usuario.
-- ============================================================
begin;
select plan(12);

-- ---------- 1. Aislamiento por tenant (GC-RLS-001) ----------
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');

select is(
  (select count(*)::int from public.persona),
  1,
  'asesor de T1 solo ve las personas de T1 (nunca las de T2)'
);

select is(
  (select count(*)::int from public.usuario),
  6,
  'asesor de T1 ve los usuarios de su tenant (6) y ninguno de T2'
);

-- ---------- 2. Alcance por rol: asesor solo lo suyo (GC-RLS-002) ----------
select is(
  (select count(*)::int from public.persona where asesor_id = 'aaaaaaaa-0000-0000-0000-000000000005'),
  0,
  'asesor A no ve personas asignadas al asesor B (mismo tenant, mismo supervisor)'
);

-- ---------- 3. Alcance por rol: supervisor ve el subárbol ----------
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'supervisor', 'aaaaaaaa-0000-0000-0000-000000000003');

select ok(
  (select count(*) from public.persona where asesor_id = 'aaaaaaaa-0000-0000-0000-000000000004') = 1,
  'supervisor ve las personas de sus asesores (subordinados())'
);

-- ---------- 4. Alcance por rol: admin ve todo su tenant ----------
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'admin', 'aaaaaaaa-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from public.persona),
  1,
  'admin de T1 ve todas las personas de T1 (1) y ninguna de T2'
);

-- ---------- 5. Escritura cross-tenant bloqueada (GC-RLS-001) ----------
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'admin', 'aaaaaaaa-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from (
     insert into public.persona (tenant_id, nombre)
     values ('22222222-2222-2222-2222-222222222222', 'Intruso')
     returning 1
   ) x),
  0,
  'admin de T1 no puede insertar persona con tenant_id de T2 (with check)'
);

-- ---------- 6. Escritura: asesor no puede reasignar a otro asesor ----------
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');

select is(
  (select count(*)::int from (
     insert into public.persona (tenant_id, nombre, asesor_id)
     values ('11111111-1111-1111-1111-111111111111', 'Robada',
             'aaaaaaaa-0000-0000-0000-000000000005')
     returning 1
   ) x),
  0,
  'asesor no puede crear persona asignada a otro asesor (with check escritura)'
);

-- ---------- 7. Visitas: solo las propias (o del subárbol) ----------
insert into public.visita (tenant_id, usuario_id, persona_nombre, departamento_id, municipio_id, actividad_id, fecha_visita)
select '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 'Finca T1',
       d.id, m.id, a.id, current_date
from public.departamento d
join public.municipio m on m.departamento_id = d.id
cross join public.actividad a
where a.tenant_id = '11111111-1111-1111-1111-111111111111'
limit 1;

select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000005');

select is(
  (select count(*)::int from public.visita),
  0,
  'asesor B no ve la visita del asesor A'
);

select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');

select is(
  (select count(*)::int from public.visita),
  1,
  'asesor A sí ve su propia visita'
);

-- ---------- 8. Claims de plataforma sin tenant no ven negocio ----------
select tests.reset_claims();
select set_config('request.jwt.claims',
  json_build_object('plataforma', true, 'superadmin', false,
                    'sub', 'cccccccc-0000-0000-0000-000000000001')::text, true);
select set_config('role', 'authenticated', true);

select is(
  (select count(*)::int from public.persona),
  0,
  'usuario de plataforma sin claim tenant_id no ve datos de negocio (GC-RLS-004)'
);

select is(
  (select count(*)::int from public.visita),
  0,
  'usuario de plataforma sin claim tenant_id no ve visitas'
);

select tests.reset_claims();

-- ---------- 9. Anónimo no ve nada ----------
select set_config('role', 'anon', true);

select is((select count(*)::int from public.persona), 0, 'rol anon no ve personas');
select is((select count(*)::int from public.usuario), 0, 'rol anon no ve usuarios');

select * from finish();
rollback;
