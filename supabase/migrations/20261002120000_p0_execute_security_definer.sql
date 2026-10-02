-- P0-1: Supabase concede EXECUTE a anon/authenticated por default privileges y
-- PUBLIC lo tiene por defecto en funciones; `revoke ... from public` en
-- migraciones previas no quitó esos grants. Ninguna política RLS aplica a anon,
-- así que anon no necesita ninguna función SECURITY DEFINER.

do $$
declare
  r record;
begin
  for r in
    select p.oid, p.oid::regprocedure as fn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proowner = current_user::regrole
       and not exists (
         select 1 from pg_depend d
          where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
       )
  loop
    -- Conservar el acceso efectivo de authenticated/service_role antes de quitar PUBLIC.
    if has_function_privilege('authenticated', r.oid, 'execute') then
      execute format('grant execute on function %s to authenticated', r.fn);
    end if;
    if has_function_privilege('service_role', r.oid, 'execute') then
      execute format('grant execute on function %s to service_role', r.fn);
    end if;
    execute format('revoke execute on function %s from public, anon', r.fn);
  end loop;
end
$$;

-- Jobs de cron, triggers y helpers que solo invocan otras funciones
-- SECURITY DEFINER o Edge con service_role. `registrar_auditoria` acepta un
-- tenant arbitrario: expuesto, permite falsificar auditoría de otro tenant.
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
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
    'public.aplicar_plantillas_rubro(uuid,text)',
    'public.sync_auth_user_claims()',
    'public.usuario_claims_refresh()',
    'public.usuario_desactivar_claims()',
    'public.trg_seed_solicitudes_al_activar()'
  ]
  loop
    -- El cast falla si la firma no existe: no se omite ninguna en silencio.
    execute format('revoke execute on function %s from authenticated', v_fn::regprocedure);
    execute format('grant execute on function %s to service_role', v_fn::regprocedure);
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
