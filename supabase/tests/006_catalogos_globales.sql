-- ============================================================
-- P-05 — Tests de catálogos globales (pgTAP)
-- Geografía, módulos y plantillas: solo plataforma escribe;
-- admin_tenant_crear copia plantillas del rubro.
-- ============================================================
begin;
select plan(14);

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

select tests.reset_claims();
select * from finish();
rollback;
