-- ============================================================
-- Gate 1 / Task 4 — sacar webhook_secret de tenant.configuracion
-- ============================================================

-- Supabase Vault está habilitado por defecto. CASCADE instala sus dependencias
-- cuando esta migración corre en una base local nueva.
create extension if not exists supabase_vault cascade;

revoke all on schema vault from public;
revoke all on schema vault from anon;
revoke all on schema vault from authenticated;
revoke all on table vault.secrets from public;
revoke all on table vault.secrets from anon;
revoke all on table vault.secrets from authenticated;
revoke all on table vault.decrypted_secrets from public;
revoke all on table vault.decrypted_secrets from anon;
revoke all on table vault.decrypted_secrets from authenticated;
revoke all on function vault.create_secret(text, text, text, uuid) from public;
revoke all on function vault.create_secret(text, text, text, uuid) from anon;
revoke all on function vault.create_secret(text, text, text, uuid) from authenticated;
revoke all on function vault.update_secret(uuid, text, text, text, uuid) from public;
revoke all on function vault.update_secret(uuid, text, text, text, uuid) from anon;
revoke all on function vault.update_secret(uuid, text, text, text, uuid) from authenticated;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table private.tenant_webhook_secret (
  tenant_id       uuid primary key references public.tenant(id) on delete cascade,
  vault_secret_id uuid not null unique,
  secret_last4    text not null,
  rotated_at      timestamptz not null
);

alter table private.tenant_webhook_secret enable row level security;

revoke all on table private.tenant_webhook_secret from public;
revoke all on table private.tenant_webhook_secret from anon;
revoke all on table private.tenant_webhook_secret from authenticated;

comment on table private.tenant_webhook_secret is
  'Referencia privada tenant→Supabase Vault; nunca contiene el secreto HMAC.';
comment on column private.tenant_webhook_secret.vault_secret_id is
  'UUID retornado por vault.create_secret().';

-- Expand/data migration/contract: crear primero las referencias Vault, mover
-- cada secreto legado y quitar únicamente esa key del JSON en la misma tx.
do $$
declare
  v_tenant_id uuid;
  v_secret text;
  v_vault_secret_id uuid;
begin
  for v_tenant_id, v_secret in
    select t.id, t.configuracion ->> 'webhook_secret'
      from public.tenant t
     where t.configuracion ? 'webhook_secret'
  loop
    select vault.create_secret(
      v_secret,
      null,
      'Webhook HMAC de tenant ' || v_tenant_id::text
    )
      into v_vault_secret_id;

    insert into private.tenant_webhook_secret (
      tenant_id,
      vault_secret_id,
      secret_last4,
      rotated_at
    )
    values (
      v_tenant_id,
      v_vault_secret_id,
      right(v_secret, 4),
      now()
    );
  end loop;

  update public.tenant
     set configuracion = coalesce(configuracion, '{}'::jsonb) - 'webhook_secret'
   where configuracion ? 'webhook_secret';
end
$$;

alter table public.tenant
  add constraint tenant_configuracion_sin_webhook_secret
  check (not (configuracion ? 'webhook_secret'));

-- Mantiene nombre y parámetro para clientes existentes; el retorno ahora es
-- JSON canónico y el plaintext solo existe en esta respuesta inmediata.
drop function public.admin_webhook_rotar_secret(uuid);

create function public.admin_webhook_rotar_secret(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_vault_secret_id uuid;
  v_last4 text;
  v_rotated_at timestamptz := clock_timestamp();
begin
  if not (
    public.es_superadmin()
    or public.plataforma_puede_operar(p_tenant_id)
  ) then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  -- El lock serializa dos rotaciones simultáneas del mismo tenant.
  perform 1
    from public.tenant
   where id = p_tenant_id
   for update;
  if not found then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;

  v_secret := encode(extensions.gen_random_bytes(32), 'hex');
  v_last4 := right(v_secret, 4);

  select tws.vault_secret_id
    into v_vault_secret_id
    from private.tenant_webhook_secret tws
   where tws.tenant_id = p_tenant_id
   for update;

  if v_vault_secret_id is null then
    select vault.create_secret(
      v_secret,
      null,
      'Webhook HMAC de tenant ' || p_tenant_id::text
    )
      into v_vault_secret_id;

    insert into private.tenant_webhook_secret (
      tenant_id,
      vault_secret_id,
      secret_last4,
      rotated_at
    )
    values (
      p_tenant_id,
      v_vault_secret_id,
      v_last4,
      v_rotated_at
    );
  else
    perform vault.update_secret(v_vault_secret_id, v_secret);

    update private.tenant_webhook_secret
       set secret_last4 = v_last4,
           rotated_at = v_rotated_at
     where tenant_id = p_tenant_id;
  end if;

  -- Defensa adicional para tenants creados/actualizados por clientes antiguos.
  update public.tenant
     set configuracion = coalesce(configuracion, '{}'::jsonb) - 'webhook_secret'
   where id = p_tenant_id;

  perform public.registrar_auditoria(
    p_tenant_id,
    'tenant_webhook_secret',
    p_tenant_id::text,
    'update',
    jsonb_build_object('estado', 'rotado', 'last4', v_last4)
  );

  return jsonb_build_object(
    'tenantId', p_tenant_id,
    'configurado', true,
    'rotadoEn', v_rotated_at,
    'last4', v_last4,
    'secret', v_secret
  );
end;
$$;

revoke all on function public.admin_webhook_rotar_secret(uuid) from public;
grant execute on function public.admin_webhook_rotar_secret(uuid) to authenticated;

comment on function public.admin_webhook_rotar_secret(uuid) is
  'Rota el secreto Vault. Solo esta respuesta contiene el plaintext.';

create function public.admin_webhook_secret_estado(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_last4 text;
  v_rotated_at timestamptz;
begin
  if not (
    public.es_superadmin()
    or public.plataforma_puede_operar(p_tenant_id)
  ) then
    raise exception 'GC-AUTH-001: requiere rol de plataforma';
  end if;

  if not exists (
    select 1
      from public.tenant t
     where t.id = p_tenant_id
  ) then
    raise exception 'GC-CORE-001: tenant inexistente';
  end if;

  select tws.secret_last4, tws.rotated_at
    into v_last4, v_rotated_at
    from private.tenant_webhook_secret tws
   where tws.tenant_id = p_tenant_id;

  return jsonb_build_object(
    'tenantId', p_tenant_id,
    'configurado', v_last4 is not null,
    'rotadoEn', v_rotated_at,
    'last4', v_last4
  );
end;
$$;

revoke all on function public.admin_webhook_secret_estado(uuid) from public;
grant execute on function public.admin_webhook_secret_estado(uuid) to authenticated;

comment on function public.admin_webhook_secret_estado(uuid) is
  'Estado canónico del secreto HMAC; nunca retorna plaintext ni UUID de Vault.';

-- Conserva contrato, permisos y comparación actual. Task 6 reemplazará la
-- comparación de strings; aquí solo cambia el origen del secreto a Vault.
create or replace function public.integracion_recibir(
  p_tenant_id uuid,
  p_origen text,
  p_tipo text,
  p_payload jsonb,
  p_cuerpo text,
  p_firma text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret   text;
  v_esperada text;
  v_firma    text;
  v_id       bigint;
  v_estado   text;
  v_firma_ok boolean := false;
  v_error    text;
  v_filas    jsonb;
  v_res      jsonb;
begin
  if p_tenant_id is null or p_tipo is null or p_cuerpo is null then
    raise exception 'GC-IMP-012: tenant, tipo y cuerpo son obligatorios';
  end if;
  if not exists (
    select 1
      from public.tenant t
     where t.id = p_tenant_id
       and t.activo
  ) then
    raise exception 'GC-CORE-001: tenant inexistente o inactivo';
  end if;

  select ds.decrypted_secret
    into v_secret
    from private.tenant_webhook_secret tws
    join vault.decrypted_secrets ds on ds.id = tws.vault_secret_id
   where tws.tenant_id = p_tenant_id;
  if v_secret is null or v_secret = '' then
    raise exception 'GC-IMP-011: webhook no configurado para este tenant';
  end if;

  v_firma := lower(regexp_replace(coalesce(p_firma, ''), '^sha256=', '', 'i'));
  v_esperada := encode(
    extensions.hmac(
      convert_to(p_cuerpo, 'UTF8'),
      convert_to(v_secret, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  -- Comparación preservada deliberadamente; se endurece en Task 6.
  v_firma_ok := (v_firma = v_esperada);

  if p_idempotency_key is not null then
    select id, estado
      into v_id, v_estado
      from public.integracion_evento
     where tenant_id = p_tenant_id
       and idempotency_key = p_idempotency_key;
    if v_id is not null then
      return jsonb_build_object(
        'id', v_id,
        'estado', v_estado,
        'idempotente', true,
        'firma_ok', v_firma_ok
      );
    end if;
  end if;

  if not v_firma_ok then
    v_error := 'GC-IMP-010: firma HMAC inválida';
    insert into public.integracion_evento (
      tenant_id,
      origen,
      tipo,
      payload,
      firma_ok,
      estado,
      idempotency_key,
      error
    )
    values (
      p_tenant_id,
      coalesce(p_origen, 'webhook'),
      p_tipo,
      coalesce(p_payload, '{}'::jsonb),
      false,
      'error',
      p_idempotency_key,
      v_error
    )
    returning id into v_id;
    return jsonb_build_object(
      'id', v_id,
      'estado', 'error',
      'firma_ok', false,
      'error', v_error
    );
  end if;

  insert into public.integracion_evento (
    tenant_id,
    origen,
    tipo,
    payload,
    firma_ok,
    estado,
    idempotency_key
  )
  values (
    p_tenant_id,
    coalesce(p_origen, 'webhook'),
    p_tipo,
    coalesce(p_payload, '{}'::jsonb),
    true,
    'pendiente',
    p_idempotency_key
  )
  returning id into v_id;

  perform set_config('app.importacion_interna', '1', true);

  begin
    v_filas := coalesce(
      p_payload -> 'filas',
      p_payload -> 'personas',
      p_payload -> 'cuentas'
    );
    if jsonb_typeof(v_filas) is distinct from 'array' then
      if (
        p_payload ? 'documento'
        or p_payload ? 'nombre'
        or p_payload ? 'codigo_externo'
      ) then
        v_filas := jsonb_build_array(p_payload);
      else
        v_filas := '[]'::jsonb;
      end if;
    end if;

    if p_tipo in ('persona.upsert', 'personas', 'persona') then
      v_res := public.admin_importar_personas(p_tenant_id, v_filas);
    elsif p_tipo in ('cuenta.snapshot', 'cuentas', 'cuenta') then
      v_res := public.admin_importar_cuentas(p_tenant_id, v_filas);
    elsif p_tipo in ('catalogo.upsert', 'catalogos', 'catalogo') then
      v_res := public.admin_importar_catalogos(p_tenant_id, v_filas);
    else
      update public.integracion_evento
         set estado = 'pendiente',
             error = 'GC-IMP-040: tipo no procesado automáticamente'
       where id = v_id;
      return jsonb_build_object(
        'id', v_id,
        'estado', 'pendiente',
        'firma_ok', true
      );
    end if;

    update public.integracion_evento
       set estado = 'procesado',
           procesado_en = now(),
           error = null
     where id = v_id;
    return jsonb_build_object(
      'id', v_id,
      'estado', 'procesado',
      'firma_ok', true,
      'resultado', v_res
    );
  exception
    when others then
      update public.integracion_evento
         set estado = 'error',
             error = sqlerrm,
             procesado_en = now()
       where id = v_id;
      return jsonb_build_object(
        'id', v_id,
        'estado', 'error',
        'firma_ok', true,
        'error', sqlerrm
      );
  end;
end;
$$;

revoke all on function public.integracion_recibir(uuid, text, text, jsonb, text, text, text) from public;
do $$
begin
  if exists (
    select 1
      from pg_roles
     where rolname = 'service_role'
  ) then
    execute 'grant execute on function public.integracion_recibir(uuid, text, text, jsonb, text, text, text) to service_role';
  end if;
end
$$;

notify pgrst, 'reload schema';
