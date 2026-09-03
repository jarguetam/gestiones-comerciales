-- ============================================================
-- Gate 1 / Task 6 — comparación HMAC-SHA256 de trabajo fijo
-- ============================================================

-- Mitigación best-effort: PL/pgSQL/PostgreSQL no ofrece una garantía
-- criptográfica de ejecución constant-time. Para digests HMAC-SHA256, esta
-- función siempre acumula el mismatch de longitud y ejecuta 32 comparaciones
-- byte a byte, sin retorno temprano ni exposición de los valores comparados.
create or replace function public.hmac_eq(
  p_a bytea,
  p_b bytea
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_len_a integer := octet_length(coalesce(p_a, ''::bytea));
  v_len_b integer := octet_length(coalesce(p_b, ''::bytea));
  v_a bytea := substring(
    coalesce(p_a, ''::bytea) || decode(repeat('00', 32), 'hex')
    from 1 for 32
  );
  v_b bytea := substring(
    coalesce(p_b, ''::bytea) || decode(repeat('00', 32), 'hex')
    from 1 for 32
  );
  v_diff integer;
  v_i integer;
begin
  v_diff := v_len_a # 32;
  v_diff := v_diff | (v_len_b # 32);

  for v_i in 0..31 loop
    v_diff := v_diff | (get_byte(v_a, v_i) # get_byte(v_b, v_i));
  end loop;

  return v_diff = 0;
end;
$$;

revoke all on function public.hmac_eq(bytea, bytea) from public;
revoke all on function public.hmac_eq(bytea, bytea) from anon;
revoke all on function public.hmac_eq(bytea, bytea) from authenticated;
revoke all on function public.hmac_eq(bytea, bytea) from service_role;

comment on function public.hmac_eq(bytea, bytea) is
  'Mitigación best-effort para HMAC-SHA256: acumula longitud/contenido en 32 iteraciones; PostgreSQL no ofrece una garantía criptográfica constant-time. Helper interno, sin acceso API.';

-- Estado final de Task 4 preservado: el secreto se lee únicamente desde Vault.
-- La firma recibida se normaliza a hex y ambos digests se comparan como bytea.
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
  v_secret    text;
  v_esperada  bytea;
  v_firma     bytea;
  v_firma_hex text;
  v_id        bigint;
  v_estado    text;
  v_firma_ok  boolean := false;
  v_error     text;
  v_filas     jsonb;
  v_res       jsonb;
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

  v_firma_hex := lower(
    regexp_replace(btrim(coalesce(p_firma, '')), '^sha256=', '', 'i')
  );
  v_firma := case
    when v_firma_hex ~ '^[0-9a-f]{64}$'
      then decode(v_firma_hex, 'hex')
    else ''::bytea
  end;
  v_esperada := extensions.hmac(
    convert_to(p_cuerpo, 'UTF8'),
    convert_to(v_secret, 'UTF8'),
    'sha256'
  );
  v_firma_ok := public.hmac_eq(v_firma, v_esperada);

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
