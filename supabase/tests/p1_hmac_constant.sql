-- ============================================================
-- Gate 1 / Task 6 — comparación HMAC-SHA256 de trabajo fijo
-- Autónomo: no crea fixtures ni depende del estado de otros tests.
-- ============================================================
begin;
set search_path = public, extensions;
select plan(25);

select ok(
  public.hmac_eq(
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('aa', 32), 'hex')
  ),
  'digests iguales de 32 bytes'
);

select ok(
  not public.hmac_eq(
    decode('ab' || repeat('aa', 31), 'hex'),
    decode(repeat('aa', 32), 'hex')
  ),
  'diferencia en el primer byte'
);

select ok(
  not public.hmac_eq(
    decode(repeat('aa', 16) || 'ab' || repeat('aa', 15), 'hex'),
    decode(repeat('aa', 32), 'hex')
  ),
  'diferencia en un byte intermedio'
);

select ok(
  not public.hmac_eq(
    decode(repeat('aa', 31) || 'ab', 'hex'),
    decode(repeat('aa', 32), 'hex')
  ),
  'diferencia en el último byte'
);

select ok(
  not public.hmac_eq(
    decode(repeat('aa', 31), 'hex'),
    decode(repeat('aa', 32), 'hex')
  ),
  'rechaza primer digest corto'
);

select ok(
  not public.hmac_eq(
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('aa', 31), 'hex')
  ),
  'rechaza segundo digest corto'
);

select ok(
  not public.hmac_eq(
    decode(repeat('aa', 33), 'hex'),
    decode(repeat('aa', 32), 'hex')
  ),
  'rechaza digest largo'
);

select ok(
  not public.hmac_eq(
    decode(repeat('aa', 31), 'hex'),
    decode(repeat('aa', 31), 'hex')
  ),
  'dos valores iguales que no miden 32 bytes no son digests válidos'
);

select is(
  public.hmac_eq(null, decode(repeat('aa', 32), 'hex')),
  false,
  'NULL se incorpora como longitud inválida'
);

select is(
  pg_get_function_result('public.hmac_eq(bytea,bytea)'::regprocedure),
  'boolean',
  'hmac_eq solo expone un boolean'
);

select is(
  (
    select p.prosecdef
      from pg_proc p
     where p.oid = 'public.hmac_eq(bytea,bytea)'::regprocedure
  ),
  true,
  'hmac_eq es SECURITY DEFINER'
);

select ok(
  pg_get_functiondef('public.hmac_eq(bytea,bytea)'::regprocedure)
    ~* E'for\\s+v_i\\s+in\\s+0\\.\\.31\\s+loop',
  'hmac_eq declara exactamente 32 iteraciones'
);

select ok(
  pg_get_functiondef('public.hmac_eq(bytea,bytea)'::regprocedure)
    ~* E'v_diff\\s*:=\\s*v_len_a\\s*#\\s*32',
  'la longitud del primer digest entra al acumulador'
);

select ok(
  pg_get_functiondef('public.hmac_eq(bytea,bytea)'::regprocedure)
    ~* E'v_diff\\s*:=\\s*v_diff\\s*\\|\\s*\\(v_len_b\\s*#\\s*32\\)',
  'la longitud del segundo digest entra al acumulador'
);

select is(
  coalesce(
    (
      select bool_or(
        acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
      )
        from pg_proc p
        cross join lateral aclexplode(p.proacl) acl
       where p.oid = 'public.hmac_eq(bytea,bytea)'::regprocedure
    ),
    false
  ),
  false,
  'PUBLIC no puede ejecutar hmac_eq'
);

select is(
  has_function_privilege(
    'anon',
    'public.hmac_eq(bytea,bytea)',
    'execute'
  ),
  false,
  'anon no puede ejecutar hmac_eq'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.hmac_eq(bytea,bytea)',
    'execute'
  ),
  false,
  'authenticated no puede ejecutar hmac_eq'
);

select is(
  has_function_privilege(
    'service_role',
    'public.hmac_eq(bytea,bytea)',
    'execute'
  ),
  false,
  'service_role no puede ejecutar hmac_eq directamente'
);

select is(
  has_function_privilege(
    'postgres',
    'public.hmac_eq(bytea,bytea)',
    'execute'
  ),
  true,
  'el owner interno conserva ejecución'
);

select ok(
  obj_description(
    'public.hmac_eq(bytea,bytea)'::regprocedure,
    'pg_proc'
  ) ilike '%best-effort%',
  'la mitigación queda documentada como best-effort'
);

select ok(
  obj_description(
    'public.hmac_eq(bytea,bytea)'::regprocedure,
    'pg_proc'
  ) ilike '%no ofrece una garantía criptográfica%',
  'la documentación niega una garantía constant-time'
);

select ok(
  pg_get_functiondef(
    'public.integracion_recibir(uuid,text,text,jsonb,text,text,text)'::regprocedure
  ) ~* E'public\\.hmac_eq\\(v_firma,\\s*v_esperada\\)',
  'integracion_recibir usa hmac_eq'
);

select ok(
  pg_get_functiondef(
    'public.integracion_recibir(uuid,text,text,jsonb,text,text,text)'::regprocedure
  ) !~* E'v_firma\\s*=\\s*v_esperada|v_esperada\\s*=\\s*v_firma',
  'integracion_recibir no compara digests con igualdad directa'
);

select ok(
  pg_get_functiondef(
    'public.integracion_recibir(uuid,text,text,jsonb,text,text,text)'::regprocedure
  ) NOT LIKE '%configuracion%',
  'integracion_recibir conserva lectura exclusiva desde Vault'
);

select is(
  pg_get_function_result(
    'public.integracion_recibir(uuid,text,text,jsonb,text,text,text)'::regprocedure
  ),
  'jsonb',
  'integracion_recibir conserva RETURNS jsonb'
);

select * from finish();
rollback;
