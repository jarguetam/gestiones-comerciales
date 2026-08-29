-- Políticas históricas leían auth.jwt() ->> 'tenant_id' en la raíz.
-- GoTrue guarda tenant_id/rol en app_metadata; sin el hook de access token
-- el JWT raíz va vacío y RLS rechaza SELECT/INSERT (móvil: GC-AUTH-022,
-- agenda vacía, no se puede agendar). tenant_id_actual() ya lee raíz,
-- app_metadata y public.usuario.

-- ---------- tenant / módulos ----------
drop policy if exists tenant_select on public.tenant;
create policy tenant_select on public.tenant
  for select to authenticated
  using (id = public.tenant_id_actual());

drop policy if exists tenant_modulo_select on public.tenant_modulo;
create policy tenant_modulo_select on public.tenant_modulo
  for select to authenticated
  using (tenant_id = public.tenant_id_actual());

-- ---------- usuario ----------
drop policy if exists usuario_select on public.usuario;
create policy usuario_select on public.usuario
  for select to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and (
      public.rol_actual() = 'admin'
      or id = auth.uid()
      or jefe_id = auth.uid()
      or id in (select public.subordinados())
    )
  );

drop policy if exists usuario_insert_admin on public.usuario;
create policy usuario_insert_admin on public.usuario
  for insert to authenticated
  with check (public.rol_actual() = 'admin' and tenant_id = public.tenant_id_actual());

drop policy if exists usuario_update_admin on public.usuario;
create policy usuario_update_admin on public.usuario
  for update to authenticated
  using (public.rol_actual() = 'admin' and tenant_id = public.tenant_id_actual());

drop policy if exists usuario_delete_admin on public.usuario;
create policy usuario_delete_admin on public.usuario
  for delete to authenticated
  using (public.rol_actual() = 'admin' and tenant_id = public.tenant_id_actual());

-- ---------- persona ----------
drop policy if exists tenant on public.persona;
create policy tenant on public.persona
  for all to authenticated
  using (tenant_id = public.tenant_id_actual())
  with check (tenant_id = public.tenant_id_actual());

drop policy if exists alcance_persona on public.persona;
create policy alcance_persona on public.persona
  for select to authenticated
  using (
    public.rol_actual() = 'admin'
    or asesor_id = auth.uid()
    or asesor_id in (select * from public.subordinados())
  );

drop policy if exists escritura_persona on public.persona;
create policy escritura_persona on public.persona
  for all to authenticated
  using (
    public.rol_actual() = 'admin'
    or asesor_id = auth.uid()
    or asesor_id in (select * from public.subordinados())
  )
  with check (
    tenant_id = public.tenant_id_actual()
    and (
      public.rol_actual() = 'admin'
      or asesor_id = auth.uid()
      or asesor_id in (select * from public.subordinados())
    )
  );

-- ---------- visita ----------
drop policy if exists tenant on public.visita;
create policy tenant on public.visita
  for all to authenticated
  using (tenant_id = public.tenant_id_actual())
  with check (tenant_id = public.tenant_id_actual());

drop policy if exists alcance_visita on public.visita;
create policy alcance_visita on public.visita
  for select to authenticated
  using (
    public.rol_actual() = 'admin'
    or usuario_id = auth.uid()
    or usuario_id in (select * from public.subordinados())
  );

drop policy if exists escritura_visita on public.visita;
create policy escritura_visita on public.visita
  for insert to authenticated
  with check (
    tenant_id = public.tenant_id_actual()
    and usuario_id = auth.uid()
  );

drop policy if exists actualizacion_visita on public.visita;
create policy actualizacion_visita on public.visita
  for update to authenticated
  using (
    usuario_id = auth.uid()
    or public.rol_actual() in ('supervisor', 'gerente', 'admin')
  )
  with check (tenant_id = public.tenant_id_actual());

create or replace function public.visitas_del_dia(p_fecha date default current_date)
returns setof public.visita
language sql
stable
set search_path = public
as $$
  select v.*
  from public.visita v
  where v.fecha_visita = p_fecha
    and (
      public.rol_actual() = 'admin'
      or v.usuario_id = auth.uid()
      or v.usuario_id in (select * from public.subordinados())
    )
  order by v.hora_inicio;
$$;

-- Alta de visita desde campo: rellena tenant_id desde la sesión (app_metadata
-- o public.usuario) y aplica GC-VIS-* en el servidor.
create or replace function public.visita_crear(
  p_persona_nombre text,
  p_actividad_id bigint,
  p_sub_actividad_id bigint,
  p_actividad_hora_id bigint,
  p_zona_id bigint,
  p_departamento_id bigint,
  p_municipio_id bigint,
  p_fecha date,
  p_hora_inicio time,
  p_persona_id bigint default null,
  p_direccion text default null,
  p_comentario text default ''
)
returns public.visita
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.tenant_id_actual();
  v public.visita;
begin
  if auth.uid() is null then
    raise exception 'GC-AUTH-001: sin sesión';
  end if;
  if v_tenant is null then
    raise exception 'GC-AUTH-001: sin tenant en la sesión';
  end if;
  if p_persona_nombre is null or length(trim(p_persona_nombre)) = 0 then
    raise exception 'GC-VIS-004: nombre del visitado requerido';
  end if;
  if p_actividad_id is null or p_sub_actividad_id is null then
    raise exception 'GC-VIS-001: actividad y subactividad requeridas';
  end if;
  if p_departamento_id is null or p_municipio_id is null or p_zona_id is null then
    raise exception 'GC-VIS-002: faltan zona o geografía del tenant';
  end if;
  if p_actividad_hora_id is null then
    raise exception 'GC-VIS-003: catálogo de horas vacío';
  end if;
  if p_fecha is null then
    raise exception 'GC-VIS-005: fecha requerida';
  end if;
  if p_hora_inicio is null then
    raise exception 'GC-VIS-006: hora de inicio requerida';
  end if;
  if not exists (
    select 1 from public.zona z where z.id = p_zona_id and z.tenant_id = v_tenant and z.activo
  ) then
    raise exception 'GC-VIS-002: la zona no pertenece al tenant';
  end if;

  insert into public.visita (
    tenant_id, usuario_id, creado_por,
    persona_id, persona_nombre, direccion, comentario,
    departamento_id, municipio_id, zona_id,
    actividad_id, sub_actividad_id, actividad_hora_id,
    fecha_visita, hora_inicio
  ) values (
    v_tenant, auth.uid(), auth.uid(),
    p_persona_id, trim(p_persona_nombre), p_direccion, coalesce(p_comentario, ''),
    p_departamento_id, p_municipio_id, p_zona_id,
    p_actividad_id, p_sub_actividad_id, p_actividad_hora_id,
    p_fecha, p_hora_inicio
  )
  returning * into v;
  return v;
end;
$$;

grant execute on function public.visita_crear(
  text, bigint, bigint, bigint, bigint, bigint, bigint, date, time, bigint, text, text
) to authenticated;

-- ---------- CRM leads ----------
drop policy if exists tenant on public.lead_origen;
create policy tenant on public.lead_origen
  for select to authenticated
  using (tenant_id = public.tenant_id_actual());

drop policy if exists gestion on public.lead_origen;
create policy gestion on public.lead_origen
  for all to authenticated
  using (tenant_id = public.tenant_id_actual() and public.rol_actual() = 'admin')
  with check (tenant_id = public.tenant_id_actual() and public.rol_actual() = 'admin');

drop policy if exists tenant on public.lead_estado;
create policy tenant on public.lead_estado
  for select to authenticated
  using (tenant_id = public.tenant_id_actual());

drop policy if exists gestion on public.lead_estado;
create policy gestion on public.lead_estado
  for all to authenticated
  using (tenant_id = public.tenant_id_actual() and public.rol_actual() = 'admin')
  with check (tenant_id = public.tenant_id_actual() and public.rol_actual() = 'admin');

drop policy if exists alcance_lead on public.lead;
create policy alcance_lead on public.lead
  for select to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and (
      public.rol_actual() = 'admin'
      or asesor_id = auth.uid()
      or asesor_id in (select * from public.subordinados())
    )
  );

drop policy if exists escritura_lead on public.lead;
create policy escritura_lead on public.lead
  for insert to authenticated
  with check (
    tenant_id = public.tenant_id_actual()
    and (asesor_id is null or asesor_id = auth.uid() or public.rol_actual() = 'admin')
  );

drop policy if exists actualizar_lead on public.lead;
create policy actualizar_lead on public.lead
  for update to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and (
      public.rol_actual() = 'admin'
      or asesor_id = auth.uid()
      or asesor_id in (select * from public.subordinados())
    )
  )
  with check (tenant_id = public.tenant_id_actual());

drop policy if exists alcance_lead_actividad on public.lead_actividad;
create policy alcance_lead_actividad on public.lead_actividad
  for select to authenticated
  using (
    tenant_id = public.tenant_id_actual()
    and (
      public.rol_actual() = 'admin'
      or exists (
        select 1 from public.lead l
        where l.id = lead_id
          and (l.asesor_id = auth.uid() or l.asesor_id in (select * from public.subordinados()))
      )
    )
  );

drop policy if exists insertar_lead_actividad on public.lead_actividad;
create policy insertar_lead_actividad on public.lead_actividad
  for insert to authenticated
  with check (
    tenant_id = public.tenant_id_actual()
    and realizado_por = auth.uid()
  );
