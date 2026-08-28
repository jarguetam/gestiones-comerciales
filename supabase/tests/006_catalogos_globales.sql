-- ============================================================
-- P-05 — Tests de catálogos globales (pgTAP)
-- Geografía, módulos y plantillas: solo plataforma escribe;
-- admin_tenant_crear copia plantillas del rubro.
-- ============================================================
begin;
select plan(19);

-- usuario de negocio no opera catálogos globales
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'admin', 'aaaaaaaa-0000-0000-0000-000000000001');

select throws_ok(
  $$select public.admin_departamento_guardar(null, 'Sololá Test')$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'admin de empresa no crea departamentos globales'
);

select throws_ok(
  $$select public.admin_plantilla_guardar(null, 'agro', 'hora', '3 horas', '{"cantidad":3}'::jsonb, true)$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'admin de empresa no edita plantillas base'
);

select throws_ok(
  $$select public.admin_geografia_importar('[{"departamento":"X","municipio":"Y"}]'::jsonb)$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'admin de empresa no importa geografía global'
);

select throws_ok(
  $$select public.admin_modulo_catalogo_guardar('intruso', 'Intruso', false)$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'admin de empresa no muta el catálogo de módulos'
);

select throws_ok(
  $$insert into public.departamento (nombre) values ('Intruso Geo')$$,
  '42501',
  'RLS bloquea INSERT directo a departamento (ADR-005)'
);

select is_empty(
  $$select id from public.catalogo_plantilla$$,
  'usuario de empresa no lee plantillas globales'
);

select tests.reset_claims();

-- plataforma (superadmin)
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000005', 'cat@plataforma.test')
on conflict (id) do nothing;
insert into public.usuario_plataforma (id, email, nombre, es_superadmin) values
  ('cccccccc-0000-0000-0000-000000000005', 'cat@plataforma.test', 'Catálogos', true)
on conflict (id) do update set es_superadmin = true, activo = true;

select set_config('request.jwt.claims',
  json_build_object('plataforma', true, 'superadmin', true,
                    'sub', 'cccccccc-0000-0000-0000-000000000005')::text, true);
select set_config('role', 'authenticated', true);

select lives_ok(
  $$select public.admin_departamento_guardar(null, 'Sololá Test')$$,
  'plataforma puede crear un departamento'
);

select throws_ok(
  $$select public.admin_departamento_guardar(null, 'Sololá Test')$$,
  'GC-CAT-002: ya existe un departamento con ese nombre',
  'departamento duplicado rechazado'
);

select lives_ok(
  $$select public.admin_municipio_guardar(
      null,
      (select id from public.departamento where nombre = 'Sololá Test'),
      'Sololá')$$,
  'plataforma puede crear un municipio'
);

select ok(
  exists (
    select 1 from public.auditoria
    where tabla = 'departamento' and cambios ->> 'nombre' = 'Sololá Test'
  ),
  'alta de departamento queda en auditoría'
);

select is(
  (public.admin_geografia_importar(
     '[{"departamento":"Sololá Test","municipio":"Nahualá"},
       {"departamento":"Zacapa Test","municipio":"Zacapa"}]'::jsonb
   ) ->> 'municipios')::int,
  2,
  'importador crea municipios nuevos (y el departamento nuevo)'
);

select lives_ok(
  $$select public.admin_modulo_catalogo_guardar('demo_rubro', 'Módulo demo', false)$$,
  'plataforma puede upsert del catálogo de módulos'
);

select ok(
  exists (select 1 from public.modulo where codigo = 'demo_rubro' and nombre = 'Módulo demo'),
  'el módulo demo quedó persistido'
);

select lives_ok(
  $$select public.admin_plantilla_guardar(
      null, 'agro', 'hora', '3 horas test', '{"cantidad":3}'::jsonb, true)$$,
  'plataforma puede crear una plantilla base'
);

select throws_ok(
  $$select public.admin_plantilla_guardar(
      null, 'agro', 'hora', 'sin cantidad', '{}'::jsonb, true)$$,
  'GC-CAT-001: cantidad debe ser un número mayor a 0',
  'plantilla hora sin cantidad se rechaza'
);

-- alta de tenant copia plantillas agro
select lives_ok(
  $$select public.admin_tenant_crear('Tenant Plantillas Agro', 'agromoney', 'pro')$$,
  'plataforma puede crear tenant que recibe plantillas del rubro'
);

select ok(
  exists (
    select 1
    from public.actividad a
    join public.tenant t on t.id = a.tenant_id
    where t.nombre = 'Tenant Plantillas Agro'
      and a.nombre = 'Verificación de garantías'
  ),
  'el tenant agro hereda actividades de catalogo_plantilla'
);

select ok(
  exists (
    select 1
    from public.formulario_plantilla f
    join public.tenant t on t.id = f.tenant_id
    where t.nombre = 'Tenant Plantillas Agro'
      and f.nombre = 'Ficha de cultivo'
  ),
  'el tenant agro hereda formularios de catalogo_plantilla'
);

-- plataforma con rol 'lectura' no muta catálogos globales
select tests.reset_claims();
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000006', 'lectura@plataforma.test')
on conflict (id) do nothing;
insert into public.usuario_plataforma (id, email, nombre, es_superadmin) values
  ('cccccccc-0000-0000-0000-000000000006', 'lectura@plataforma.test', 'Lectura', false)
on conflict (id) do update set es_superadmin = false, activo = true;
insert into public.usuario_plataforma_tenant (usuario_plataforma_id, tenant_id, rol)
values ('cccccccc-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'lectura')
on conflict do nothing;

select set_config('request.jwt.claims',
  json_build_object('plataforma', true, 'superadmin', false,
                    'sub', 'cccccccc-0000-0000-0000-000000000006')::text, true);
select set_config('role', 'authenticated', true);

select throws_ok(
  $$select public.admin_departamento_guardar(null, 'Lectura No Puede')$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'plataforma con rol lectura no escribe catálogos globales'
);

select tests.reset_claims();
select * from finish();
rollback;
