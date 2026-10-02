begin;
select plan(7);

select is(
  (select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by 1), '')
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1 from pg_depend d
         where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
      and has_function_privilege('anon', p.oid, 'execute')),
  '',
  'anon no ejecuta ninguna función SECURITY DEFINER de public'
);

select is(
  (select coalesce(string_agg(f, ', ' order by f), '')
     from unnest(array[
       'public.registrar_auditoria(uuid,text,text,text,jsonb)',
       'public.registrar_edge_invocacion(text,boolean,text,integer,uuid)',
       'public.recordatorio_depositos()',
       'public.recordatorio_kilometraje()',
       'public.snapshot_cuentas()',
       'public.integracion_recibir(uuid,text,text,jsonb,text,text,text)',
       'public.integracion_encolar(uuid,text,text,jsonb,boolean)',
       'public.integracion_procesar(bigint)',
       'public.importar_lote(text,jsonb,uuid)',
       'public.importar_personas(jsonb)',
       'public.aplicar_plantillas_rubro(uuid,text)'
     ]) f
    where has_function_privilege('authenticated', f::regprocedure, 'execute')),
  '',
  'authenticated no ejecuta jobs ni helpers internos'
);

select ok(
  has_function_privilege('service_role', 'public.snapshot_cuentas()', 'execute')
  and has_function_privilege('service_role',
    'public.integracion_recibir(uuid,text,text,jsonb,text,text,text)', 'execute'),
  'service_role conserva jobs e integración'
);

select ok(
  has_function_privilege('authenticated',
    'public.visita_completar(bigint,text,numeric,numeric)', 'execute')
  and has_function_privilege('authenticated', 'public.tenant_id_actual()', 'execute'),
  'authenticated conserva RPC de cliente y helpers de RLS'
);

select ok(
  has_function_privilege('supabase_auth_admin',
    'public.custom_access_token_hook(jsonb)', 'execute'),
  'el auth hook sigue ejecutable por supabase_auth_admin'
);

select ok(
  has_function_privilege('anon', 'public.salud_ping()', 'execute'),
  'el probe de PostgREST es ejecutable con la clave pública'
);

select tests.set_claims(
  '11111111-1111-1111-1111-111111111111', 'asesor', 'aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok(
  $$select public.registrar_auditoria(
      '22222222-2222-2222-2222-222222222222', 'visita', '1', 'update', '{}'::jsonb)$$,
  '42501',
  null,
  'un usuario no puede escribir auditoría de otro tenant'
);

select tests.reset_claims();
select * from finish();
rollback;
