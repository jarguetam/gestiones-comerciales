-- Gate 1 / Task 10 — políticas restantes con tenant_id_actual() / rol_actual().

-- ---------- deposito ----------
drop policy if exists alcance_deposito on public.deposito;
create policy alcance_deposito on public.deposito
  for select to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and public.modulo_activo(tenant_id, 'depositos')
    and public.asesor_en_alcance(asesor_id)
  );

drop policy if exists insertar_deposito on public.deposito;
create policy insertar_deposito on public.deposito
  for insert to authenticated
  with check (
    tenant_id = public.tenant_id_actual()
    and public.modulo_activo(tenant_id, 'depositos')
    and asesor_id = auth.uid()
    and estado = 'pendiente'
  );

drop policy if exists actualizar_deposito on public.deposito;
create policy actualizar_deposito on public.deposito
  for update to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and public.modulo_activo(tenant_id, 'depositos')
    and public.asesor_en_alcance(asesor_id)
    and public.rol_actual() in ('admin', 'supervisor')
  )
  with check (tenant_id = public.tenant_id_actual());

create or replace function public.deposito_confirmar(
  p_id bigint,
  p_estado text
)
returns public.deposito
language plpgsql security definer
set search_path = public
as $$
declare
  v_dep public.deposito;
  v_rol text := public.rol_actual();
begin
  if v_rol not in ('admin', 'supervisor') then
    raise exception 'GC-DEPO-001: el depósito solo lo confirma un supervisor o admin';
  end if;
  if p_estado not in ('confirmado', 'rechazado') then
    raise exception 'GC-DEPO-001: el estado destino debe ser confirmado o rechazado';
  end if;

  select * into v_dep from public.deposito where id = p_id for update;
  if not found then
    raise exception 'GC-DEPO-001: depósito no encontrado';
  end if;

  if v_dep.tenant_id is distinct from public.tenant_id_actual()
     or not public.asesor_en_alcance(v_dep.asesor_id) then
    raise exception 'GC-DEPO-001: sin alcance sobre este depósito';
  end if;

  if not public.modulo_activo(v_dep.tenant_id, 'depositos') then
    raise exception 'GC-DEPO-001: módulo depositos no activo';
  end if;

  if v_dep.estado <> 'pendiente' then
    raise exception 'GC-DEPO-001: el depósito solo es confirmable en estado pendiente';
  end if;

  update public.deposito
     set estado         = p_estado,
         confirmado_por = auth.uid(),
         confirmado_en  = now()
   where id = v_dep.id
  returning * into v_dep;

  perform public.registrar_auditoria(
    v_dep.tenant_id, 'deposito', v_dep.id::text, 'update',
    jsonb_build_object('estado', p_estado)
  );

  return v_dep;
end;
$$;

-- ---------- solicitud ----------
drop policy if exists alcance_solicitud_estado on public.solicitud_estado;
create policy alcance_solicitud_estado on public.solicitud_estado
  for select to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and public.modulo_activo(tenant_id, 'solicitudes')
  );

drop policy if exists gestion_solicitud_estado on public.solicitud_estado;
create policy gestion_solicitud_estado on public.solicitud_estado
  for all to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and public.rol_actual() = 'admin'
    and public.modulo_activo(tenant_id, 'solicitudes')
  )
  with check (
    tenant_id = public.tenant_id_actual()
    and public.rol_actual() = 'admin'
  );

drop policy if exists alcance_solicitud on public.solicitud;
create policy alcance_solicitud on public.solicitud
  for select to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and public.modulo_activo(tenant_id, 'solicitudes')
    and public.asesor_en_alcance(asesor_id)
  );

drop policy if exists insertar_solicitud on public.solicitud;
create policy insertar_solicitud on public.solicitud
  for insert to authenticated
  with check (
    tenant_id = public.tenant_id_actual()
    and public.modulo_activo(tenant_id, 'solicitudes')
    and (
      asesor_id = auth.uid()
      or public.rol_actual() in ('admin', 'supervisor', 'gerente')
    )
  );

drop policy if exists actualizar_solicitud on public.solicitud;
create policy actualizar_solicitud on public.solicitud
  for update to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and public.modulo_activo(tenant_id, 'solicitudes')
    and public.asesor_en_alcance(asesor_id)
  )
  with check (tenant_id = public.tenant_id_actual());

drop policy if exists alcance_solicitud_archivo on public.solicitud_archivo;
create policy alcance_solicitud_archivo on public.solicitud_archivo
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = public.tenant_id_actual()
        and public.modulo_activo(s.tenant_id, 'solicitudes')
        and public.asesor_en_alcance(s.asesor_id)
    )
  );

drop policy if exists insertar_solicitud_archivo on public.solicitud_archivo;
create policy insertar_solicitud_archivo on public.solicitud_archivo
  for insert to authenticated
  with check (
    exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = public.tenant_id_actual()
        and public.modulo_activo(s.tenant_id, 'solicitudes')
        and (s.asesor_id = auth.uid() or public.rol_actual() in ('admin','supervisor','gerente'))
    )
  );

drop policy if exists alcance_solicitud_firma on public.solicitud_firma;
create policy alcance_solicitud_firma on public.solicitud_firma
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = public.tenant_id_actual()
        and public.modulo_activo(s.tenant_id, 'solicitudes')
        and public.asesor_en_alcance(s.asesor_id)
    )
  );

drop policy if exists insertar_solicitud_firma on public.solicitud_firma;
create policy insertar_solicitud_firma on public.solicitud_firma
  for insert to authenticated
  with check (
    firmado_por = auth.uid()
    and exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = public.tenant_id_actual()
        and public.modulo_activo(s.tenant_id, 'solicitudes')
        and (s.asesor_id = auth.uid() or public.rol_actual() in ('admin','supervisor','gerente'))
    )
  );

drop policy if exists actualizar_solicitud_firma on public.solicitud_firma;
create policy actualizar_solicitud_firma on public.solicitud_firma
  for update to authenticated
  using (
    exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = public.tenant_id_actual()
        and public.asesor_en_alcance(s.asesor_id)
    )
  );

create or replace function public.solicitud_transicion(
  p_solicitud_id bigint,
  p_estado_codigo text,
  p_comentario text default null
)
returns public.solicitud
language plpgsql security definer
set search_path = public
as $$
declare
  v_sol     public.solicitud;
  v_origen  public.solicitud_estado;
  v_destino public.solicitud_estado;
  v_rol     text := public.rol_actual();
begin
  select * into v_sol from public.solicitud where id = p_solicitud_id for update;
  if not found then
    raise exception 'GC-SOLI-004: solicitud no encontrada';
  end if;

  if not public.modulo_activo(v_sol.tenant_id, 'solicitudes') then
    raise exception 'GC-SOLI-005: módulo solicitudes no activo';
  end if;

  if v_sol.tenant_id is distinct from public.tenant_id_actual()
     or not public.asesor_en_alcance(v_sol.asesor_id) then
    raise exception 'GC-SOLI-004: sin alcance sobre esta solicitud';
  end if;

  select * into v_origen from public.solicitud_estado where id = v_sol.estado_id;
  select * into v_destino from public.solicitud_estado
   where tenant_id = v_sol.tenant_id and codigo = p_estado_codigo;
  if not found then
    raise exception 'GC-SOLI-006: estado destino inexistente';
  end if;

  if v_origen.codigo in ('aprobada', 'rechazada') then
    raise exception 'GC-SOLI-003: la solicitud ya está en un estado terminal';
  end if;

  if v_origen.id = v_destino.id then
    return v_sol;
  end if;

  if v_destino.codigo = 'rechazada' and v_origen.codigo not in ('enviada', 'firmada') then
    raise exception 'GC-SOLI-002: no se puede rechazar desde %', v_origen.codigo;
  end if;

  if v_destino.codigo <> 'rechazada' then
    if v_destino.orden <> v_origen.orden + 1 then
      raise exception 'GC-SOLI-002: transición inválida % → %', v_origen.codigo, v_destino.codigo;
    end if;
    if v_destino.codigo = 'firmada' and not exists (
      select 1 from public.solicitud_firma f where f.solicitud_id = v_sol.id
    ) then
      raise exception 'GC-SOLI-002: no se puede firmar sin una firma registrada';
    end if;
  end if;

  if v_sol.asesor_id <> auth.uid() and v_rol not in ('admin', 'gerente', 'supervisor') then
    raise exception 'GC-SOLI-004: solo el dueño o un supervisor puede transicionar';
  end if;
  if v_destino.codigo = 'aprobada' and v_rol not in ('admin', 'gerente', 'supervisor') then
    raise exception 'GC-SOLI-002: aprobar requiere rol supervisor o superior';
  end if;

  update public.solicitud
     set estado_id = v_destino.id
   where id = v_sol.id
  returning * into v_sol;

  perform public.registrar_auditoria(
    v_sol.tenant_id, 'solicitud', v_sol.id::text, 'update',
    jsonb_build_object(
      'estado', v_destino.codigo,
      'anterior', v_origen.codigo,
      'comentario', p_comentario
    )
  );

  return v_sol;
end;
$$;

-- ---------- storage ----------
do $$
begin
  drop policy if exists firmas_select on storage.objects;
  create policy firmas_select on storage.objects
    for select to authenticated
    using (
      bucket_id = 'firmas'
      and (storage.foldername(name))[1] = public.tenant_id_actual()::text
    );

  drop policy if exists firmas_insert on storage.objects;
  create policy firmas_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'firmas'
      and (storage.foldername(name))[1] = public.tenant_id_actual()::text
    );

  drop policy if exists documentos_select on storage.objects;
  create policy documentos_select on storage.objects
    for select to authenticated
    using (
      bucket_id = 'documentos'
      and (storage.foldername(name))[1] = public.tenant_id_actual()::text
    );

  drop policy if exists documentos_insert on storage.objects;
  create policy documentos_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'documentos'
      and (storage.foldername(name))[1] = public.tenant_id_actual()::text
    );

  drop policy if exists importes_select on storage.objects;
  create policy importes_select on storage.objects
    for select to authenticated
    using (
      bucket_id = 'importes'
      and (storage.foldername(name))[1] = coalesce(public.tenant_id_actual()::text, '')
    );

  drop policy if exists importes_insert on storage.objects;
  create policy importes_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'importes'
      and (storage.foldername(name))[1] = coalesce(public.tenant_id_actual()::text, '')
    );
exception
  when others then
    raise notice 'storage policies jwt helpers: omitido (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';
