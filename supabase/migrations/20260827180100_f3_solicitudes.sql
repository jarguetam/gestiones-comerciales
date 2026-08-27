-- ============================================================
-- F3.2 — Módulo solicitudes (spec db §5.2, backend GC-SOLI-*)
--   solicitud_estado, solicitud, solicitud_archivo, solicitud_firma
--   RPC solicitud_transicion(id, estado_codigo, comentario)
--   Seed de estados al activar el módulo. Historial vía auditoría.
-- ============================================================

create table public.solicitud_estado (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,
  nombre    text not null,
  orden     int not null default 0,
  unique (tenant_id, codigo)
);

create table public.solicitud (
  id                      bigint generated always as identity primary key,
  tenant_id               uuid not null references public.tenant(id),
  persona_id              bigint not null references public.persona(id),
  asesor_id               uuid not null references public.usuario(id),
  estado_id               bigint not null references public.solicitud_estado(id),
  monto                   numeric(18,2),
  descripcion             text not null,
  formulario_respuesta_id bigint references public.formulario_respuesta(id),
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now()
);
create index on public.solicitud (tenant_id, estado_id);
create index on public.solicitud (asesor_id, creado_en desc);

create table public.solicitud_archivo (
  id           bigint generated always as identity primary key,
  solicitud_id bigint not null references public.solicitud(id) on delete cascade,
  ruta         text not null,
  tipo         text not null default 'adjunto',
  creado_en    timestamptz not null default now()
);

create table public.solicitud_firma (
  solicitud_id bigint primary key references public.solicitud(id) on delete cascade,
  firma_ruta   text not null,
  pdf_ruta     text,
  firmado_en   timestamptz not null default now(),
  firmado_por  uuid not null references public.usuario(id)
);

create trigger trg_solicitud_actualizado before update on public.solicitud
  for each row execute function public.set_actualizado_en();

-- ---------- seed de flujo por tenant ----------
create or replace function public.seed_solicitud_estados(p_tenant uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.solicitud_estado (tenant_id, codigo, nombre, orden) values
    (p_tenant, 'borrador',  'Borrador',  1),
    (p_tenant, 'enviada',   'Enviada',   2),
    (p_tenant, 'firmada',   'Firmada',   3),
    (p_tenant, 'aprobada',  'Aprobada',  4),
    (p_tenant, 'rechazada', 'Rechazada', 99)
  on conflict (tenant_id, codigo) do nothing;
end;
$$;

create or replace function public.trg_seed_solicitudes_al_activar()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  select m.codigo into v_codigo from public.modulo m where m.id = new.modulo_id;
  if new.activo and v_codigo = 'solicitudes' then
    perform public.seed_solicitud_estados(new.tenant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_seed_solicitudes_al_activar on public.tenant_modulo;
create trigger trg_seed_solicitudes_al_activar
  after insert or update of activo on public.tenant_modulo
  for each row execute function public.trg_seed_solicitudes_al_activar();

-- ---------- RLS ----------
alter table public.solicitud_estado  enable row level security;
alter table public.solicitud         enable row level security;
alter table public.solicitud_archivo enable row level security;
alter table public.solicitud_firma   enable row level security;

create policy alcance_solicitud_estado on public.solicitud_estado
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'solicitudes')
  );
create policy gestion_solicitud_estado on public.solicitud_estado
  for all to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (auth.jwt() ->> 'rol') = 'admin'
    and public.modulo_activo(tenant_id, 'solicitudes')
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (auth.jwt() ->> 'rol') = 'admin'
  );

create policy alcance_solicitud on public.solicitud
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'solicitudes')
    and public.asesor_en_alcance(asesor_id)
  );

create policy insertar_solicitud on public.solicitud
  for insert to authenticated
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'solicitudes')
    and (
      asesor_id = auth.uid()
      or (auth.jwt() ->> 'rol') in ('admin', 'supervisor', 'gerente')
    )
  );

-- el estado solo cambia vía RPC; el dueño/admin puede editar monto/descripcion
create policy actualizar_solicitud on public.solicitud
  for update to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and public.modulo_activo(tenant_id, 'solicitudes')
    and public.asesor_en_alcance(asesor_id)
  )
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy alcance_solicitud_archivo on public.solicitud_archivo
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        and public.modulo_activo(s.tenant_id, 'solicitudes')
        and public.asesor_en_alcance(s.asesor_id)
    )
  );
create policy insertar_solicitud_archivo on public.solicitud_archivo
  for insert to authenticated
  with check (
    exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        and public.modulo_activo(s.tenant_id, 'solicitudes')
        and (s.asesor_id = auth.uid() or (auth.jwt() ->> 'rol') in ('admin','supervisor','gerente'))
    )
  );

create policy alcance_solicitud_firma on public.solicitud_firma
  for select to authenticated
  using (
    exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        and public.modulo_activo(s.tenant_id, 'solicitudes')
        and public.asesor_en_alcance(s.asesor_id)
    )
  );
create policy insertar_solicitud_firma on public.solicitud_firma
  for insert to authenticated
  with check (
    firmado_por = auth.uid()
    and exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        and public.modulo_activo(s.tenant_id, 'solicitudes')
        and (s.asesor_id = auth.uid() or (auth.jwt() ->> 'rol') in ('admin','supervisor','gerente'))
    )
  );
create policy actualizar_solicitud_firma on public.solicitud_firma
  for update to authenticated
  using (
    exists (
      select 1 from public.solicitud s
      where s.id = solicitud_id
        and s.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        and public.asesor_en_alcance(s.asesor_id)
    )
  );

-- ---------- RPC solicitud_transicion ----------
-- Flujo: borrador → enviada → firmada → aprobada; rechazada desde enviada/firmada.
-- No se salta orden (GC-SOLI-002). Terminales no salen (GC-SOLI-003).
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
  v_rol     text := auth.jwt() ->> 'rol';
begin
  select * into v_sol from public.solicitud where id = p_solicitud_id for update;
  if not found then
    raise exception 'GC-SOLI-004: solicitud no encontrada';
  end if;

  if not public.modulo_activo(v_sol.tenant_id, 'solicitudes') then
    raise exception 'GC-SOLI-005: módulo solicitudes no activo';
  end if;

  if v_sol.tenant_id is distinct from (auth.jwt() ->> 'tenant_id')::uuid
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

  -- rechazada solo desde enviada o firmada
  if v_destino.codigo = 'rechazada' and v_origen.codigo not in ('enviada', 'firmada') then
    raise exception 'GC-SOLI-002: no se puede rechazar desde %', v_origen.codigo;
  end if;

  -- avance: solo al siguiente orden (firmada exige firma). No saltos.
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

  -- solo dueño o supervisor+ mueven; asesor no aprueba
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

grant select, insert, update on public.solicitud to authenticated;
grant select, insert on public.solicitud_archivo to authenticated;
grant select, insert, update on public.solicitud_firma to authenticated;
grant select on public.solicitud_estado to authenticated;
grant insert, update, delete on public.solicitud_estado to authenticated;
grant execute on function public.solicitud_transicion(bigint, text, text) to authenticated;
grant execute on function public.seed_solicitud_estados(uuid) to authenticated;

-- Storage: buckets privados de firmas y PDFs (spec backend §7)
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('firmas', 'firmas', false), ('documentos', 'documentos', false)
  on conflict (id) do nothing;

  execute $pol$
    create policy firmas_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'firmas'
        and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
      )
  $pol$;
  execute $pol$
    create policy firmas_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'firmas'
        and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
      )
  $pol$;
  execute $pol$
    create policy documentos_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'documentos'
        and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
      )
  $pol$;
  execute $pol$
    create policy documentos_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'documentos'
        and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
      )
  $pol$;
exception
  when others then
    raise notice 'storage firmas/documentos: omitido (%). Continúa la migración.', sqlerrm;
end $$;
