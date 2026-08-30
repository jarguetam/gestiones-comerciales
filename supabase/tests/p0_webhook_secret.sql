-- ============================================================
-- Gate 1 / Task 4 — webhook HMAC secret en Supabase Vault
-- Archivo autónomo: crea Auth antes de perfiles y no depende de 000_setup.
-- ============================================================
begin;
set search_path = public, extensions;
select plan(48);

create schema if not exists tests;

create or replace function tests.set_claims(
  p_tenant uuid,
  p_rol text,
  p_uid uuid
)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'tenant_id', p_tenant::text,
      'rol', p_rol,
      'sub', p_uid::text
    )::text,
    true
  );
$$;

create or replace function tests.reset_claims()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '', true);
$$;

-- Auth siempre precede a public.usuario/public.usuario_plataforma por FK.
insert into auth.users (id, email)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin-empresa@vault.test'),
  ('dddddddd-0000-0000-0000-000000000004', 'superadmin@vault.test'),
  ('dddddddd-0000-0000-0000-000000000005', 'owner@vault.test'),
  ('dddddddd-0000-0000-0000-000000000006', 'soporte@vault.test'),
  ('dddddddd-0000-0000-0000-000000000007', 'inactivo@vault.test')
on conflict (id) do nothing;

insert into public.tenant (
  id,
  codigo,
  nombre,
  rubro,
  plan,
  configuracion
)
values (
  '11111111-1111-1111-1111-111111111111',
  'TASK4-VAULT',
  'Tenant Task 4',
  'agro',
  'pro',
  jsonb_build_object(
    'dominios_cors',
    jsonb_build_array('app.agromoney.gt')
  )
)
on conflict (id) do update
set configuracion = excluded.configuracion;

insert into public.usuario (id, tenant_id, nombre, rol)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Admin Empresa',
  'admin'
)
on conflict (id) do update
set tenant_id = excluded.tenant_id,
    nombre = excluded.nombre,
    rol = excluded.rol;

insert into public.usuario_plataforma (
  id,
  email,
  nombre,
  es_superadmin,
  activo
)
values
  (
    'dddddddd-0000-0000-0000-000000000004',
    'superadmin@vault.test',
    'Superadmin Activo',
    true,
    true
  ),
  (
    'dddddddd-0000-0000-0000-000000000005',
    'owner@vault.test',
    'Owner Activo',
    false,
    true
  ),
  (
    'dddddddd-0000-0000-0000-000000000006',
    'soporte@vault.test',
    'Soporte Activo',
    false,
    true
  ),
  (
    'dddddddd-0000-0000-0000-000000000007',
    'inactivo@vault.test',
    'Superadmin Inactivo',
    true,
    false
  )
on conflict (id) do update
set es_superadmin = excluded.es_superadmin,
    activo = excluded.activo;

insert into public.usuario_plataforma_tenant (
  usuario_plataforma_id,
  tenant_id,
  rol
)
values
  (
    'dddddddd-0000-0000-0000-000000000005',
    '11111111-1111-1111-1111-111111111111',
    'owner'
  ),
  (
    'dddddddd-0000-0000-0000-000000000006',
    '11111111-1111-1111-1111-111111111111',
    'soporte'
  )
on conflict (usuario_plataforma_id, tenant_id) do update
set rol = excluded.rol;

-- Prueba el guard/capture que EXPAND instala antes de BACKFILL. El CHECK final
-- se quita solo dentro de esta transacción y se restaura antes del contract.
alter table public.tenant
  drop constraint tenant_configuracion_sin_webhook_secret;

insert into public.tenant (id, codigo, nombre, rubro, plan)
values
  (
    '44444444-0000-0000-0000-000000000001',
    'LEGACY-VALID',
    'Legacy válido',
    'agro',
    'pro'
  ),
  (
    '44444444-0000-0000-0000-000000000002',
    'LEGACY-NULL',
    'Legacy null',
    'agro',
    'pro'
  ),
  (
    '44444444-0000-0000-0000-000000000003',
    'LEGACY-OBJECT',
    'Legacy objeto',
    'agro',
    'pro'
  ),
  (
    '44444444-0000-0000-0000-000000000004',
    'LEGACY-EMPTY',
    'Legacy vacío',
    'agro',
    'pro'
  ),
  (
    '44444444-0000-0000-0000-000000000005',
    'LEGACY-CONCURRENT',
    'Legacy concurrente',
    'agro',
    'pro'
  );

insert into public.usuario_plataforma_tenant (
  usuario_plataforma_id,
  tenant_id,
  rol
)
values
  (
    'dddddddd-0000-0000-0000-000000000005',
    '44444444-0000-0000-0000-000000000005',
    'owner'
  ),
  (
    'dddddddd-0000-0000-0000-000000000006',
    '44444444-0000-0000-0000-000000000005',
    'soporte'
  );

-- BACKFILL usa rol postgres sin auth.uid y una marca local a su transacción.
select set_config('app.webhook_secret_backfill', '1', true);
update public.tenant
   set configuracion = case id
     when '44444444-0000-0000-0000-000000000001'::uuid
       then '{"webhook_secret":"legacy-hmac-secret","otra":"conservar"}'::jsonb
     when '44444444-0000-0000-0000-000000000002'::uuid
       then '{"webhook_secret":null,"otra":"null"}'::jsonb
     when '44444444-0000-0000-0000-000000000003'::uuid
       then '{"webhook_secret":{"invalido":true},"otra":"objeto"}'::jsonb
     when '44444444-0000-0000-0000-000000000004'::uuid
       then '{"webhook_secret":"","otra":"vacio"}'::jsonb
     else configuracion
   end
 where id in (
   '44444444-0000-0000-0000-000000000001',
   '44444444-0000-0000-0000-000000000002',
   '44444444-0000-0000-0000-000000000003',
   '44444444-0000-0000-0000-000000000004'
 );
select set_config('app.webhook_secret_backfill', '', true);

select is(
  (
    select ds.decrypted_secret
      from private.tenant_webhook_secret tws
      join vault.decrypted_secrets ds on ds.id = tws.vault_secret_id
     where tws.tenant_id = '44444444-0000-0000-0000-000000000001'
  ),
  'legacy-hmac-secret',
  'el plaintext descifrado es idéntico al valor legacy'
);

select is(
  (
    select tws.secret_last4
      from private.tenant_webhook_secret tws
     where tws.tenant_id = '44444444-0000-0000-0000-000000000001'
  ),
  right('legacy-hmac-secret', 4),
  'la rutina guarda last4 correcto'
);

select ok(
  (
    select tws.rotated_at is not null
      from private.tenant_webhook_secret tws
     where tws.tenant_id = '44444444-0000-0000-0000-000000000001'
  ),
  'la rutina guarda rotated_at'
);

select is(
  (
    select configuracion
      from public.tenant
     where id = '44444444-0000-0000-0000-000000000001'
  ),
  '{"otra":"conservar"}'::jsonb,
  'migrar elimina solo webhook_secret del fixture válido'
);

select is(
  (
    select configuracion
      from public.tenant
     where id = '44444444-0000-0000-0000-000000000002'
  ),
  '{"otra":"null"}'::jsonb,
  'webhook_secret null se limpia sin crear un secreto inválido'
);

select is(
  (
    select configuracion
      from public.tenant
     where id = '44444444-0000-0000-0000-000000000003'
  ),
  '{"otra":"objeto"}'::jsonb,
  'webhook_secret no-string se limpia sin abortar'
);

select is(
  (
    select configuracion
      from public.tenant
     where id = '44444444-0000-0000-0000-000000000004'
  ),
  '{"otra":"vacio"}'::jsonb,
  'webhook_secret vacío se limpia sin crear Vault inválido'
);

select is(
  (
    select count(*)::integer
      from private.tenant_webhook_secret
     where tenant_id in (
       '44444444-0000-0000-0000-000000000002',
       '44444444-0000-0000-0000-000000000003',
       '44444444-0000-0000-0000-000000000004'
     )
  ),
  0,
  'los tres valores legacy inválidos no crean referencias Vault'
);

select is(
  (
    select count(*)::integer
      from private.tenant_webhook_secret
     where tenant_id in (
       '44444444-0000-0000-0000-000000000001',
       '44444444-0000-0000-0000-000000000002',
       '44444444-0000-0000-0000-000000000003',
       '44444444-0000-0000-0000-000000000004'
     )
  ),
  1,
  'solo existe la referencia del secreto legacy válido'
);

-- Un JWT de admin tenant no se convierte en "migración" aunque la sesión SQL
-- sea postgres; el guard exige auth.uid superadmin o la marca de backfill.
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'admin',
  'aaaaaaaa-0000-0000-0000-000000000001'
);

select throws_ok(
  $$update public.tenant
       set configuracion = configuracion
                           || '{"webhook_secret":"bypass-admin"}'::jsonb
     where id = '44444444-0000-0000-0000-000000000005'$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'el guard rechaza bypass por configuracion de admin tenant'
);

select tests.reset_claims();

set local role service_role;
select throws_ok(
  $$update public.tenant
       set configuracion = configuracion
                           || '{"webhook_secret":"bypass-service-role"}'::jsonb
     where id = '44444444-0000-0000-0000-000000000005'$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'service_role sin marca de backfill no puede capturar por configuracion'
);
reset role;

-- Owner y soporte sí pueden entrar a admin_tenant_actualizar, pero el trigger
-- les impide usar configuracion como un RPC alternativo de rotación.
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'plataforma',
  'dddddddd-0000-0000-0000-000000000005'
);
set local role authenticated;

select throws_ok(
  $$select public.admin_tenant_actualizar(
      '44444444-0000-0000-0000-000000000005',
      '{"configuracion":{"webhook_secret":"bypass-owner"}}'::jsonb
    )$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'el guard rechaza bypass por configuracion de owner'
);

reset role;
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'plataforma',
  'dddddddd-0000-0000-0000-000000000006'
);
set local role authenticated;

select throws_ok(
  $$select public.admin_tenant_actualizar(
      '44444444-0000-0000-0000-000000000005',
      '{"configuracion":{"webhook_secret":"bypass-soporte"}}'::jsonb
    )$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'el guard rechaza bypass por configuracion de soporte'
);

reset role;
select tests.reset_claims();

-- Una escritura legacy concurrente autorizada sí se captura y se retira.
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'plataforma',
  'dddddddd-0000-0000-0000-000000000004'
);
set local role authenticated;

select lives_ok(
  $$select public.admin_tenant_actualizar(
      '44444444-0000-0000-0000-000000000005',
      '{"configuracion":{"webhook_secret":"capturado-concurrente","otra":"queda"}}'::jsonb
    )$$,
  'el guard captura una escritura legacy de superadmin activo'
);

reset role;
select tests.reset_claims();

select is(
  (
    select ds.decrypted_secret
      from private.tenant_webhook_secret tws
      join vault.decrypted_secrets ds on ds.id = tws.vault_secret_id
     where tws.tenant_id = '44444444-0000-0000-0000-000000000005'
  ),
  'capturado-concurrente',
  'la captura concurrente conserva plaintext idéntico en Vault'
);

select is(
  (
    select configuracion
      from public.tenant
     where id = '44444444-0000-0000-0000-000000000005'
  ),
  '{"otra":"queda"}'::jsonb,
  'la captura concurrente retira solo webhook_secret'
);

select ok(
  not coalesce(
    (
      select a.cambios -> 'configuracion' ? 'webhook_secret'
        from public.auditoria a
       where a.tenant_id = '44444444-0000-0000-0000-000000000005'
         and a.tabla = 'tenant'
         and a.accion = 'update'
       order by a.id desc
       limit 1
    ),
    false
  ),
  'auditoría elimina configuracion.webhook_secret'
);

select is(
  (
    select strpos(a.cambios::text, 'capturado-concurrente')
      from public.auditoria a
     where a.tenant_id = '44444444-0000-0000-0000-000000000005'
       and a.tabla = 'tenant'
       and a.accion = 'update'
     order by a.id desc
     limit 1
  ),
  0,
  'auditoría no contiene el plaintext capturado'
);

select is(
  (
    select a.cambios #>> '{configuracion,otra}'
      from public.auditoria a
     where a.tenant_id = '44444444-0000-0000-0000-000000000005'
       and a.tabla = 'tenant'
       and a.accion = 'update'
     order by a.id desc
     limit 1
  ),
  'queda',
  'redacción conserva el resto de configuracion en auditoría'
);

alter table public.tenant
  add constraint tenant_configuracion_sin_webhook_secret
  check (not (configuracion ? 'webhook_secret')) not valid;
alter table public.tenant
  validate constraint tenant_configuracion_sin_webhook_secret;

select throws_ok(
  $$update public.tenant
       set configuracion = configuracion || '{"webhook_secret":"no-reintroducir"}'::jsonb
     where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514',
  null,
  'la base impide reintroducir webhook_secret en configuracion'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.capture_tenant_webhook_secret()',
    'execute'
  ),
  false,
  'authenticated no puede ejecutar la función trigger privada'
);

select is(
  has_function_privilege(
    'service_role',
    'private.capture_tenant_webhook_secret()',
    'execute'
  ),
  false,
  'service_role no puede ejecutar la función trigger privada'
);

select is(
  to_regprocedure('private.migrar_webhook_secrets_legacy()'),
  null,
  'no queda helper one-shot de backfill'
);

select columns_are(
  'private',
  'tenant_webhook_secret',
  array['tenant_id', 'vault_secret_id', 'secret_last4', 'rotated_at'],
  'la relación privada solo guarda tenant, referencia Vault y metadatos'
);

select is(
  has_table_privilege(
    'authenticated',
    'private.tenant_webhook_secret',
    'select'
  ),
  false,
  'authenticated no tiene GRANT SELECT sobre la relación privada'
);

select is(
  has_table_privilege(
    'authenticated',
    'vault.decrypted_secrets',
    'select'
  ),
  false,
  'authenticated no tiene GRANT SELECT sobre secretos descifrados'
);

-- Admin de empresa: sin acceso a tabla, Vault ni RPC administrativos.
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'admin',
  'aaaaaaaa-0000-0000-0000-000000000001'
);
set local role authenticated;

select throws_ok(
  $$select tenant_id from private.tenant_webhook_secret limit 1$$,
  '42501',
  null,
  'authenticated no puede leer la relación privada'
);

select throws_ok(
  $$select decrypted_secret from vault.decrypted_secrets limit 1$$,
  '42501',
  null,
  'authenticated no puede consultar plaintext directamente en Vault'
);

select throws_ok(
  $$select public.admin_webhook_rotar_secret('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'admin de empresa no puede rotar'
);

select throws_ok(
  $$select public.admin_webhook_secret_estado('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'admin de empresa no puede consultar estado'
);

reset role;
select tests.reset_claims();

-- Owner, soporte y superadmin inactivo deben ser rechazados por ambos RPC.
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'plataforma',
  'dddddddd-0000-0000-0000-000000000005'
);
set local role authenticated;

select throws_ok(
  $$select public.admin_webhook_rotar_secret('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'owner no puede rotar'
);

select throws_ok(
  $$select public.admin_webhook_secret_estado('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'owner no puede consultar estado'
);

reset role;
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'plataforma',
  'dddddddd-0000-0000-0000-000000000006'
);
set local role authenticated;

select throws_ok(
  $$select public.admin_webhook_rotar_secret('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'soporte no puede rotar'
);

select throws_ok(
  $$select public.admin_webhook_secret_estado('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'soporte no puede consultar estado'
);

reset role;
select tests.reset_claims();
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'plataforma',
  'dddddddd-0000-0000-0000-000000000007'
);
set local role authenticated;

select throws_ok(
  $$select public.admin_webhook_rotar_secret('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'superadmin inactivo no puede rotar'
);

select throws_ok(
  $$select public.admin_webhook_secret_estado('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere superadmin activo de plataforma',
  'superadmin inactivo no puede consultar estado'
);

reset role;
select tests.reset_claims();

-- Solo el superadmin activo puede rotar y consultar estado.
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'plataforma',
  'dddddddd-0000-0000-0000-000000000004'
);
set local role authenticated;

select set_config(
  'tests.webhook_rotation_secret',
  public.admin_webhook_rotar_secret(
    '11111111-1111-1111-1111-111111111111'
  ),
  true
);

select is(
  length(current_setting('tests.webhook_rotation_secret')),
  64,
  'rotación conserva contrato text y revela 32 bytes una vez'
);

select set_config(
  'tests.webhook_status_result',
  public.admin_webhook_secret_estado(
    '11111111-1111-1111-1111-111111111111'
  )::text,
  true
);

select is(
  (current_setting('tests.webhook_status_result')::jsonb ->> 'configurado')::boolean,
  true,
  'RPC de estado marca el secreto configurado'
);

select is(
  current_setting('tests.webhook_status_result')::jsonb ->> 'tenantId',
  '11111111-1111-1111-1111-111111111111',
  'RPC de estado identifica el tenant'
);

select is(
  current_setting('tests.webhook_status_result')::jsonb ->> 'last4',
  right(current_setting('tests.webhook_rotation_secret'), 4),
  'RPC de estado retorna last4 del nuevo secreto'
);

select ok(
  current_setting('tests.webhook_status_result')::jsonb ->> 'rotadoEn' is not null,
  'RPC de estado retorna rotadoEn'
);

select ok(
  not (current_setting('tests.webhook_status_result')::jsonb ? 'secret'),
  'RPC de estado nunca retorna plaintext'
);

reset role;
select tests.reset_claims();

select is(
  pg_get_function_result(
    'public.admin_webhook_rotar_secret(uuid)'::regprocedure
  ),
  'text',
  'admin_webhook_rotar_secret conserva RETURNS text'
);

select unlike(
  pg_get_functiondef(
    'public.integracion_recibir(uuid,text,text,jsonb,text,text,text)'::regprocedure
  ),
  'configuracion',
  'CONTRACT deja integracion_recibir sin fallback a tenant.configuracion'
);

select is(
  (
    select ds.decrypted_secret
      from private.tenant_webhook_secret tws
      join vault.decrypted_secrets ds on ds.id = tws.vault_secret_id
     where tws.tenant_id = '11111111-1111-1111-1111-111111111111'
  ),
  current_setting('tests.webhook_rotation_secret'),
  'Vault conserva el secreto recuperable emitido por rotación'
);

select is(
  (
    select configuracion
      from public.tenant
     where id = '11111111-1111-1111-1111-111111111111'
  ),
  '{"dominios_cors":["app.agromoney.gt"]}'::jsonb,
  'rotar mantiene configuracion sin secret y conserva las demás keys'
);

select is(
  (
    public.integracion_recibir(
      '11111111-1111-1111-1111-111111111111',
      'pgtap',
      'tipo.no.procesado',
      '{}'::jsonb,
      '{}',
      encode(
        hmac(
          convert_to('{}', 'UTF8'),
          convert_to(current_setting('tests.webhook_rotation_secret'), 'UTF8'),
          'sha256'
        ),
        'hex'
      ),
      'task4-vault-valid'
    ) ->> 'firma_ok'
  )::boolean,
  true,
  'integracion_recibir sigue leyendo plaintext desde Vault'
);

select ok(
  not exists (
    select 1
      from public.tenant
     where configuracion ? 'webhook_secret'
  ),
  'ningún tenant conserva webhook_secret en configuracion'
);

select * from finish();
rollback;
