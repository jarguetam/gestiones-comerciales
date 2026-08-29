-- ============================================================
-- Gate 1 / Task 4 — webhook HMAC secret en Supabase Vault
-- ============================================================
begin;
set search_path = public, extensions;
select plan(19);

-- La rotación debe conservar el resto de tenant.configuracion.
update public.tenant
   set configuracion = jsonb_build_object('dominios_cors', jsonb_build_array('app.agromoney.gt'))
 where id = '11111111-1111-1111-1111-111111111111';

insert into public.usuario_plataforma (id, email, nombre, es_superadmin, activo)
values (
  'dddddddd-0000-0000-0000-000000000004',
  'vault-admin@plataforma.test',
  'Vault Admin',
  true,
  true
)
on conflict (id) do update
set es_superadmin = excluded.es_superadmin,
    activo = excluded.activo;

insert into auth.users (id, email)
values ('dddddddd-0000-0000-0000-000000000004', 'vault-admin@plataforma.test')
on conflict (id) do nothing;

select columns_are(
  'private',
  'tenant_webhook_secret',
  array['tenant_id', 'vault_secret_id', 'secret_last4', 'rotated_at'],
  'la relación privada solo guarda tenant, referencia Vault y metadatos'
);

-- Un authenticated de negocio no puede leer la relación ni usar RPC de plataforma.
select tests.set_claims(
  '11111111-1111-1111-1111-111111111111',
  'admin',
  'aaaaaaaa-0000-0000-0000-000000000001'
);

select throws_ok(
  $$select tenant_id from private.tenant_webhook_secret limit 1$$,
  '42501',
  null,
  'authenticated no puede leer la relación privada'
);

select is(
  has_table_privilege('authenticated', 'private.tenant_webhook_secret', 'select'),
  false,
  'authenticated no tiene GRANT SELECT sobre la relación privada'
);

select throws_ok(
  $$select public.admin_webhook_rotar_secret('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'admin de empresa no puede obtener plaintext mediante rotación'
);

select throws_ok(
  $$select public.admin_webhook_secret_estado('11111111-1111-1111-1111-111111111111')$$,
  'GC-AUTH-001: requiere rol de plataforma',
  'admin de empresa no puede consultar el estado de plataforma'
);

-- Un administrador de plataforma autorizado puede rotar.
select tests.reset_claims();
select set_config(
  'request.jwt.claims',
  json_build_object(
    'plataforma', true,
    'superadmin', true,
    'sub', 'dddddddd-0000-0000-0000-000000000004'
  )::text,
  true
);
select set_config('role', 'authenticated', true);

select set_config(
  'tests.webhook_rotation_result',
  public.admin_webhook_rotar_secret('11111111-1111-1111-1111-111111111111')::text,
  true
);

select is(
  jsonb_typeof(current_setting('tests.webhook_rotation_result')::jsonb),
  'object',
  'rotación retorna un contrato JSON canónico'
);

select ok(
  length(current_setting('tests.webhook_rotation_result')::jsonb ->> 'secret') = 64,
  'rotación revela el plaintext de 32 bytes una sola vez'
);

select is(
  (current_setting('tests.webhook_rotation_result')::jsonb ->> 'configurado')::boolean,
  true,
  'respuesta de rotación marca el secreto configurado'
);

select is(
  current_setting('tests.webhook_rotation_result')::jsonb ->> 'tenantId',
  '11111111-1111-1111-1111-111111111111',
  'respuesta de rotación identifica el tenant'
);

select is(
  current_setting('tests.webhook_rotation_result')::jsonb ->> 'last4',
  right(current_setting('tests.webhook_rotation_result')::jsonb ->> 'secret', 4),
  'last4 corresponde al plaintext recién emitido'
);

select ok(
  current_setting('tests.webhook_rotation_result')::jsonb ->> 'rotadoEn' is not null,
  'respuesta de rotación incluye rotadoEn'
);

select set_config(
  'tests.webhook_status_result',
  public.admin_webhook_secret_estado('11111111-1111-1111-1111-111111111111')::text,
  true
);

select is(
  (current_setting('tests.webhook_status_result')::jsonb ->> 'configurado')::boolean,
  true,
  'RPC de estado marca el secreto configurado'
);

select ok(
  not (current_setting('tests.webhook_status_result')::jsonb ? 'secret'),
  'RPC de estado nunca retorna plaintext'
);

select is(
  current_setting('tests.webhook_status_result')::jsonb ->> 'last4',
  current_setting('tests.webhook_rotation_result')::jsonb ->> 'last4',
  'RPC de estado retorna el last4 canónico'
);

select ok(
  not coalesce(
    (select configuracion ? 'webhook_secret'
       from public.tenant
      where id = '11111111-1111-1111-1111-111111111111'),
    false
  ),
  'tenant.configuracion queda sin webhook_secret'
);

select is(
  (
    select configuracion -> 'dominios_cors'
      from public.tenant
     where id = '11111111-1111-1111-1111-111111111111'
  ),
  jsonb_build_array('app.agromoney.gt'),
  'limpiar webhook_secret conserva las demás keys de configuracion'
);

select tests.reset_claims();

select is(
  (
    select ds.decrypted_secret
      from private.tenant_webhook_secret tws
      join vault.decrypted_secrets ds on ds.id = tws.vault_secret_id
     where tws.tenant_id = '11111111-1111-1111-1111-111111111111'
  ),
  current_setting('tests.webhook_rotation_result')::jsonb ->> 'secret',
  'Vault conserva el secreto recuperable para verificar HMAC'
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
          convert_to(current_setting('tests.webhook_rotation_result')::jsonb ->> 'secret', 'UTF8'),
          'sha256'
        ),
        'hex'
      ),
      'task4-vault-valid'
    ) ->> 'firma_ok'
  )::boolean,
  true,
  'integracion_recibir verifica HMAC leyendo el plaintext desde Vault'
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
