-- ============================================================
-- F0.6 — Tests de RLS de plataforma y auditoría de admin_* (pgTAP)
-- Regla: un usuario SIN membresía de plataforma no opera RPC admin_*;
-- las operaciones autorizadas quedan auditadas (GC-AUD-*).
-- ============================================================
begin;
select plan(5);

-- ---------- 1. Sin membresía de plataforma: admin_tenant_crear rechazado ----------
-- usuario de negocio común (asesor T1): sin claim plataforma, sin membresía
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');

select throws_ok(
  $$select public.admin_tenant_crear('Tenant Intruso', 'agro')$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'usuario sin membresía de plataforma no puede crear tenants'
);

select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'admin', 'aaaaaaaa-0000-0000-0000-000000000001');

select throws_ok(
  $$select public.admin_modulo_activar('11111111-1111-1111-1111-111111111111', 'creditos', true)$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'admin de tenant de negocio tampoco puede activar módulos (eso es de plataforma)'
);

select tests.reset_claims();

-- ---------- 2. Con membresía owner: admin_tenant_crear funciona + audita ----------
insert into public.usuario_plataforma (id, email, nombre, es_superadmin) values
  ('cccccccc-0000-0000-0000-000000000001', 'owner@plataforma.test', 'Owner Plataforma', true);
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'owner@plataforma.test')
on conflict (id) do nothing;

select set_config('request.jwt.claims',
  json_build_object('plataforma', true, 'superadmin', true,
                    'sub', 'cccccccc-0000-0000-0000-000000000001')::text, true);
select set_config('role', 'authenticated', true);

select lives_ok(
  $$select public.admin_tenant_crear('Tenant Nuevo Test', 'farmacia', 'pro')$$,
  'plataforma (superadmin) puede crear tenant'
);

select ok(
  exists (
    select 1 from public.auditoria
    where accion = 'insert' and tabla = 'tenant'
      and detalles ->> 'nombre' = 'Tenant Nuevo Test'
  ),
  'la creación del tenant quedó en auditoría (GC-AUD-*)'
);

-- ---------- 3. admin_modulo_activar con plataforma: funciona + audita ----------
select lives_ok(
  $$select public.admin_modulo_activar(
      (select id from public.tenant where nombre = 'Tenant Nuevo Test'),
      'creditos', true)$$,
  'plataforma puede activar módulo creditos para el tenant nuevo'
);

select ok(
  exists (
    select 1 from public.auditoria
    where tabla = 'tenant_modulo' and accion = 'update'
      and detalles ->> 'activo' = 'true'
  ),
  'la activación del módulo quedó en auditoría'
);

select tests.reset_claims();
select * from finish();
rollback;
