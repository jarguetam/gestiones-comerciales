-- ============================================================
-- F2.2 — RPCs del embudo CRM (spec db §5.4 / backend SPEC)
--   lead_transicion / lead_convertir / lead_reasignar / crm_funnel
--   Reglas re-verificadas server-side (no solo triggers): GC-CRM-001..005
-- ============================================================

-- ---------- helper: alcance de un lead para el usuario actual ----------
create or replace function public.lead_es_visible(p_asesor uuid, p_tenant uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_tenant = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      (auth.jwt() ->> 'rol') = 'admin'
      or p_asesor = auth.uid()
      or p_asesor in (select * from public.subordinados())
    );
$$;

-- ---------- lead_transicion(id, estado_codigo, motivo?) ----------
-- Valida CRM-1 (adelante o a ganado/perdido; retroceso solo supervisor+),
-- CRM-2 (perdido exige motivo), CRM-3 (ganado dispara conversión), CRM-4
-- (lead con persona_id no retrocede). Registra en lead_actividad.
create or replace function public.lead_transicion(
  p_lead_id    bigint,
  p_estado_cod text,
  p_motivo     text default null
)
returns public.lead
language plpgsql security definer
set search_path = public
as $$
declare
  v_lead    public.lead;
  v_origen  public.lead_estado;
  v_destino public.lead_estado;
  v_rol     text := auth.jwt() ->> 'rol';
  v_es_supervisor_plus boolean := v_rol in ('admin','gerente','supervisor');
begin
  select * into v_lead from public.lead where id = p_lead_id for update;
  if not found then
    raise exception 'GC-CRM-000: lead no encontrado';
  end if;

  -- alcance: dueño, subárbol o admin del tenant
  if not public.lead_es_visible(v_lead.asesor_id, v_lead.tenant_id) then
    raise exception 'GC-CRM-006: sin alcance sobre este lead';
  end if;
  -- mover solo el dueño o supervisor+
  if v_lead.asesor_id <> auth.uid() and not v_es_supervisor_plus then
    raise exception 'GC-CRM-006: solo el dueño o un supervisor puede mover el lead';
  end if;

  select * into v_origen from public.lead_estado where id = v_lead.estado_id;
  select * into v_destino from public.lead_estado
    where tenant_id = v_lead.tenant_id and codigo = p_estado_cod and activo;
  if not found then
    raise exception 'GC-CRM-007: estado destino inexistente o inactivo';
  end if;

  -- CRM-4: lead ya convertido no retrocede
  if v_lead.persona_id is not null and v_destino.orden < v_origen.orden then
    raise exception 'GC-CRM-004: un lead convertido no puede volver a estados previos';
  end if;

  -- CRM-1: retroceso (a estado de menor orden, no ganado/perdido) requiere supervisor+
  if v_destino.orden < v_origen.orden
     and not v_destino.es_ganado and not v_destino.es_perdido
     and not v_es_supervisor_plus then
    raise exception 'GC-CRM-001: retroceder en el embudo requiere rol supervisor o superior';
  end if;

  -- CRM-2: entrar a perdido exige motivo
  if v_destino.es_perdido and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'GC-CRM-002: marcar el lead como perdido exige un motivo';
  end if;

  update public.lead
  set estado_id      = v_destino.id,
      perdido_motivo = case when v_destino.es_perdido then p_motivo else perdido_motivo end
  where id = v_lead.id
  returning * into v_lead;

  insert into public.lead_actividad
    (tenant_id, lead_id, tipo, estado_anterior_id, estado_nuevo_id, descripcion, realizado_por)
  values
    (v_lead.tenant_id, v_lead.id, 'estado', v_origen.id, v_destino.id,
     coalesce(p_motivo, 'transición ' || v_origen.codigo || ' → ' || v_destino.codigo),
     auth.uid());

  perform public.registrar_auditoria(v_lead.tenant_id, 'lead', v_lead.id::text, 'update',
    jsonb_build_object('estado', v_destino.codigo));

  -- CRM-3: entrada a ganado dispara conversión idempotente
  if v_destino.es_ganado then
    perform public.lead_convertir(v_lead.id);
    select * into v_lead from public.lead where id = v_lead.id;
  end if;

  return v_lead;
end;
$$;

-- ---------- lead_convertir(id) ----------
-- Conversión idempotente lead→persona (match por documento o teléfono).
-- GC-CRM-003. Si ya tiene persona_id, no duplica.
create or replace function public.lead_convertir(p_lead_id bigint)
returns public.lead
language plpgsql security definer
set search_path = public
as $$
declare
  v_lead    public.lead;
  v_persona bigint;
begin
  select * into v_lead from public.lead where id = p_lead_id for update;
  if not found then
    raise exception 'GC-CRM-000: lead no encontrado';
  end if;

  -- idempotente: ya convertido
  if v_lead.persona_id is not null then
    return v_lead;
  end if;

  if not public.lead_es_visible(v_lead.asesor_id, v_lead.tenant_id) then
    raise exception 'GC-CRM-006: sin alcance sobre este lead';
  end if;

  -- match por documento, si no por teléfono (dentro del tenant)
  select id into v_persona from public.persona
   where tenant_id = v_lead.tenant_id
     and activo
     and (
       (v_lead.documento is not null and documento = v_lead.documento)
       or (v_lead.telefono is not null and detalles ->> 'telefono' = v_lead.telefono)
     )
   limit 1;

  if v_persona is null then
    insert into public.persona (tenant_id, nombre, documento, direccion, asesor_id, detalles)
    values (
      v_lead.tenant_id, v_lead.nombre, v_lead.documento, v_lead.direccion,
      coalesce(v_lead.asesor_id, auth.uid()),
      jsonb_build_object('telefono', v_lead.telefono, 'email', v_lead.email, 'origen_lead', v_lead.id)
    )
    returning id into v_persona;
  end if;

  update public.lead
  set persona_id = v_persona, convertido_en = now()
  where id = v_lead.id
  returning * into v_lead;

  perform public.registrar_auditoria(v_lead.tenant_id, 'lead', v_lead.id::text, 'update',
    jsonb_build_object('convertido_persona', v_persona));

  return v_lead;
end;
$$;

-- ---------- lead_reasignar(id, nuevo_asesor) ----------
-- GC-CRM-005: solo supervisor/gerente/admin; audita en lead_actividad.
create or replace function public.lead_reasignar(
  p_lead_id     bigint,
  p_nuevo_asesor uuid
)
returns public.lead
language plpgsql security definer
set search_path = public
as $$
declare
  v_lead public.lead;
  v_rol  text := auth.jwt() ->> 'rol';
begin
  if v_rol not in ('admin','gerente','supervisor') then
    raise exception 'GC-CRM-005: reasignar un lead requiere rol supervisor o superior';
  end if;

  select * into v_lead from public.lead where id = p_lead_id for update;
  if not found then
    raise exception 'GC-CRM-000: lead no encontrado';
  end if;
  if not public.lead_es_visible(v_lead.asesor_id, v_lead.tenant_id) then
    raise exception 'GC-CRM-006: sin alcance sobre este lead';
  end if;

  -- el nuevo asesor debe ser del mismo tenant y estar activo
  if not exists (
    select 1 from public.usuario
    where id = p_nuevo_asesor and tenant_id = v_lead.tenant_id and activo
  ) then
    raise exception 'GC-CRM-008: asesor destino inexistente, inactivo o de otro tenant';
  end if;

  update public.lead set asesor_id = p_nuevo_asesor where id = v_lead.id
  returning * into v_lead;

  insert into public.lead_actividad (tenant_id, lead_id, tipo, descripcion, realizado_por)
  values (v_lead.tenant_id, v_lead.id, 'nota',
          'reasignado a asesor ' || p_nuevo_asesor::text, auth.uid());

  perform public.registrar_auditoria(v_lead.tenant_id, 'lead', v_lead.id::text, 'update',
    jsonb_build_object('reasignado_a', p_nuevo_asesor));

  return v_lead;
end;
$$;

-- ---------- crm_funnel(p_desde, p_hasta) ----------
-- Embudo agregado por estado con alcance por rol (asesor propios → admin tenant).
create or replace function public.crm_funnel(p_desde date default null, p_hasta date default null)
returns table (
  estado_id        bigint,
  estado_codigo    text,
  estado_nombre    text,
  orden            int,
  es_ganado        boolean,
  es_perdido       boolean,
  leads            bigint,
  monto_estimado   numeric
)
language sql stable security definer
set search_path = public
as $$
  select e.id, e.codigo, e.nombre, e.orden, e.es_ganado, e.es_perdido,
         count(l.id) as leads,
         coalesce(sum(l.monto_estimado), 0) as monto_estimado
  from public.lead_estado e
  left join public.lead l
    on l.estado_id = e.id
   and (p_desde is null or l.creado_en >= p_desde)
   and (p_hasta is null or l.creado_en < p_hasta + 1)
   and (
     (auth.jwt() ->> 'rol') = 'admin'
     or l.asesor_id = auth.uid()
     or l.asesor_id in (select * from public.subordinados())
   )
  where e.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and e.activo
  group by e.id, e.codigo, e.nombre, e.orden, e.es_ganado, e.es_perdido
  order by e.orden;
$$;

grant execute on function public.lead_es_visible(uuid, uuid) to authenticated;
grant execute on function public.lead_transicion(bigint, text, text) to authenticated;
grant execute on function public.lead_convertir(bigint) to authenticated;
grant execute on function public.lead_reasignar(bigint, uuid) to authenticated;
grant execute on function public.crm_funnel(date, date) to authenticated;
