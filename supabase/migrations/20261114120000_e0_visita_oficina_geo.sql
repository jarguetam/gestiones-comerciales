-- E0 / Task 1 — visita_crear resuelve oficina (zona) y geografía en el
-- servidor y es idempotente por p_cliente_key.
--
-- Orden de resolución:
--   1. replay: p_cliente_key ya existente -> misma visita (mismo usuario) o
--      GC-VIS-007 (otro usuario).
--   2. zona := p_zona_id, zona del usuario, primera zona activa de la empresa
--      (por nombre). Sin zona -> GC-VIS-002.
--   3. municipio := p_municipio_id, municipio de la persona, municipio de la
--      zona, primer municipio por id.
--   4. departamento := p_departamento_id, departamento del municipio resuelto.

alter table public.zona
  add column if not exists departamento_id bigint null references public.departamento (id),
  add column if not exists municipio_id bigint null references public.municipio (id);

-- Sin el drop, una llamada por nombre sin p_cliente_key sería ambigua.
drop function if exists public.visita_crear(
  text, bigint, bigint, bigint, bigint, bigint, bigint, date, time, bigint, text, text
);

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
  p_comentario text default '',
  p_cliente_key uuid default null
)
returns public.visita
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.tenant_id_actual();
  v public.visita;
  v_zona bigint;
  v_municipio bigint;
  v_departamento bigint;
begin
  if auth.uid() is null then
    raise exception 'GC-AUTH-001: sin sesión';
  end if;
  if v_tenant is null then
    raise exception 'GC-AUTH-001: sin tenant en la sesión';
  end if;

  -- 1. Replay idempotente.
  if p_cliente_key is not null then
    select * into v from public.visita where cliente_key = p_cliente_key;
    if found then
      if v.usuario_id = auth.uid() and v.tenant_id = v_tenant then
        return v;
      end if;
      raise exception 'GC-VIS-007: clave de cliente en uso';
    end if;
  end if;

  if p_persona_nombre is null or length(trim(p_persona_nombre)) = 0 then
    raise exception 'GC-VIS-004: nombre del visitado requerido';
  end if;
  if p_actividad_id is null or p_sub_actividad_id is null then
    raise exception 'GC-VIS-001: actividad y subactividad requeridas';
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

  -- 2. Zona (oficina).
  select u.zona_id into v_zona from public.usuario u where u.id = auth.uid();
  v_zona := coalesce(
    p_zona_id,
    v_zona,
    (select z.id
       from public.zona z
      where z.tenant_id = v_tenant and z.activo
      order by z.nombre, z.id
      limit 1)
  );
  if v_zona is null then
    raise exception 'GC-VIS-002: la empresa no tiene oficinas activas';
  end if;
  if not exists (
    select 1 from public.zona z where z.id = v_zona and z.tenant_id = v_tenant and z.activo
  ) then
    raise exception 'GC-VIS-002: la zona no pertenece al tenant';
  end if;

  -- 3. Municipio y 4. departamento.
  v_municipio := coalesce(
    p_municipio_id,
    (select p.municipio_id from public.persona p
      where p.id = p_persona_id and p.tenant_id = v_tenant),
    (select z.municipio_id from public.zona z where z.id = v_zona),
    (select m.id from public.municipio m order by m.id limit 1)
  );
  v_departamento := coalesce(
    p_departamento_id,
    (select m.departamento_id from public.municipio m where m.id = v_municipio)
  );
  if v_municipio is null or v_departamento is null then
    raise exception 'GC-VIS-002: faltan zona o geografía del tenant';
  end if;

  begin
    insert into public.visita (
      tenant_id, usuario_id, creado_por,
      persona_id, persona_nombre, direccion, comentario,
      departamento_id, municipio_id, zona_id,
      actividad_id, sub_actividad_id, actividad_hora_id,
      fecha_visita, hora_inicio, cliente_key
    ) values (
      v_tenant, auth.uid(), auth.uid(),
      p_persona_id, trim(p_persona_nombre), p_direccion, coalesce(p_comentario, ''),
      v_departamento, v_municipio, v_zona,
      p_actividad_id, p_sub_actividad_id, p_actividad_hora_id,
      p_fecha, p_hora_inicio, coalesce(p_cliente_key, gen_random_uuid())
    )
    returning * into v;
  exception when unique_violation then
    -- Carrera con otra llamada de la misma clave: reintentar como replay.
    if p_cliente_key is null then
      raise;
    end if;
    select * into v from public.visita where cliente_key = p_cliente_key;
    if found and v.usuario_id = auth.uid() and v.tenant_id = v_tenant then
      return v;
    end if;
    raise exception 'GC-VIS-007: clave de cliente en uso';
  end;
  return v;
end;
$$;

revoke all on function public.visita_crear(
  text, bigint, bigint, bigint, bigint, bigint, bigint, date, time, bigint, text, text, uuid
) from public, anon;
grant execute on function public.visita_crear(
  text, bigint, bigint, bigint, bigint, bigint, bigint, date, time, bigint, text, text, uuid
) to authenticated;
