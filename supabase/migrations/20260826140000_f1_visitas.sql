-- ============================================================
-- F1 · Migración 005 — Visitas: catálogos y operación de campo
-- Ref: spec/db/SPEC.md §4.4, spec-agromoney-v2.md §3.5, §5.1
-- Máquina de estados: programada → completada → aprobada/rechazada; anulada.
-- ============================================================

-- ---------- catálogos por tenant ----------
create table public.actividad (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  nombre    text not null,
  activo    boolean not null default true,
  unique (tenant_id, nombre)
);

create table public.sub_actividad (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  actividad_id  bigint not null references public.actividad(id) on delete cascade,
  nombre        text not null,
  activo        boolean not null default true,
  unique (tenant_id, actividad_id, nombre)
);

-- ex ActivitieHour: bloques de horas seleccionables al registrar una visita
create table public.actividad_hora (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  nombre    text not null,      -- ej. "2 horas"
  cantidad  numeric(4,2) not null,
  activo    boolean not null default true
);

-- ---------- visita (operación de campo) ----------
create table public.visita (
  id                  bigint generated always as identity primary key,
  tenant_id           uuid not null references public.tenant(id),
  usuario_id          uuid not null references public.usuario(id),
  persona_id          bigint references public.persona(id),
  persona_nombre      text not null,          -- texto libre: se visitan no-clientes
  direccion           text,
  comentario          text not null default '',
  departamento_id     bigint not null references public.departamento(id),
  municipio_id        bigint not null references public.municipio(id),
  zona_id             bigint not null references public.zona(id),
  actividad_id        bigint not null references public.actividad(id),
  sub_actividad_id    bigint not null references public.sub_actividad(id),
  actividad_hora_id   bigint not null references public.actividad_hora(id),
  fecha_visita        date not null,
  hora_inicio         time not null default '08:00',
  estado              text not null default 'programada'
                        check (estado in ('programada','completada','aprobada','rechazada','anulada')),
  latitud             numeric(10,7),
  longitud            numeric(10,7),
  completada_en       timestamptz,
  revisada_por        uuid references public.usuario(id),
  revisada_en         timestamptz,
  comentario_rechazo  text,
  cliente_key         uuid not null default gen_random_uuid(),  -- idempotencia offline, §9.3
  creado_por          uuid not null references public.usuario(id),
  creado_en           timestamptz not null default now(),
  unique (cliente_key)
);

create index on public.visita (tenant_id);
create index on public.visita (usuario_id, fecha_visita desc);
create index on public.visita (estado);
create index on public.visita (actividad_id);

-- ---------- triggers ----------
create trigger trg_visita_actualizado
  before update on public.visita
  for each row execute function public.set_actualizado_en();

-- La subactividad debe pertenecer a la actividad elegida (integridad del dropdown dependiente)
create or replace function public.validar_subactividad()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.sub_actividad sa
    where sa.id = new.sub_actividad_id
      and sa.actividad_id = new.actividad_id
      and sa.activo
  ) then
    raise exception 'sub_actividad % no pertenece a la actividad %', new.sub_actividad_id, new.actividad_id;
  end if;
  return new;
end;
$$;

create trigger trg_visita_subactividad
  before insert or update of actividad_id, sub_actividad_id on public.visita
  for each row execute function public.validar_subactividad();

-- ---------- RLS ----------
alter table public.actividad enable row level security;
alter table public.sub_actividad enable row level security;
alter table public.actividad_hora enable row level security;
alter table public.visita enable row level security;

-- catálogos: visibles y editables dentro del tenant
create policy tenant_actividad on public.actividad
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_sub_actividad on public.sub_actividad
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_actividad_hora on public.actividad_hora
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- visita: aislamiento por tenant
create policy tenant on public.visita
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- visita: alcance por rol (admin todo; gerente/supervisor subárbol; asesor propio)
create policy alcance_visita on public.visita
  for select to authenticated
  using (
    (auth.jwt() ->> 'rol') = 'admin'
    or usuario_id = auth.uid()
    or usuario_id in (select * from public.subordinados())
  );

create policy escritura_visita on public.visita
  for insert to authenticated
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and usuario_id = auth.uid()
  );

-- solo el dueño edita/actualiza su visita (checkin, completar)
create policy actualizacion_visita on public.visita
  for update to authenticated
  using (
    usuario_id = auth.uid()
    or (auth.jwt() ->> 'rol') in ('supervisor','gerente','admin')
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- ---------- grants ----------
grant select, insert, update on public.actividad, public.sub_actividad, public.actividad_hora to authenticated;
grant select, insert, update on public.visita to authenticated;

-- ---------- RPC: agenda del día ----------
create or replace function public.visitas_del_dia(p_fecha date default current_date)
returns setof public.visita
language sql stable
set search_path = public
as $$
  select v.*
  from public.visita v
  where v.fecha_visita = p_fecha
    and (
      (auth.jwt() ->> 'rol') = 'admin'
      or v.usuario_id = auth.uid()
      or v.usuario_id in (select * from public.subordinados())
    )
  order by v.hora_inicio;
$$;

-- ---------- RPC: check-in GPS (solo el dueño, estado programada) ----------
create or replace function public.visita_checkin(
  p_visita_id bigint,
  p_latitud   numeric(10,7),
  p_longitud  numeric(10,7),
  p_cliente_key uuid default null
)
returns public.visita
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visita;
begin
  select * into v from public.visita
  where (p_cliente_key is null and id = p_visita_id) or cliente_key = p_cliente_key
  for update;

  if not found then
    raise exception 'visita no encontrada';
  end if;
  if v.usuario_id <> auth.uid() then
    raise exception 'solo el dueño puede hacer check-in';
  end if;
  if v.estado not in ('programada','completada') then
    raise exception 'check-in no permitido en estado %', v.estado;
  end if;

  update public.visita
  set latitud = p_latitud, longitud = p_longitud
  where id = v.id
  returning * into v;

  perform public.registrar_auditoria(
    v.tenant_id, 'visita', v.id::text, 'update',
    jsonb_build_object('checkin', jsonb_build_array(p_latitud, p_longitud))
  );
  return v;
end;
$$;

-- ---------- RPC: completar (solo el dueño) ----------
create or replace function public.visita_completar(
  p_visita_id     bigint,
  p_comentario    text default null,
  p_latitud       numeric(10,7) default null,
  p_longitud      numeric(10,7) default null
)
returns public.visita
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visita;
begin
  select * into v from public.visita where id = p_visita_id for update;
  if not found then raise exception 'visita no encontrada'; end if;
  if v.usuario_id <> auth.uid() then
    raise exception 'solo el dueño puede completar la visita';
  end if;
  if v.estado <> 'programada' then
    raise exception 'transición inválida desde estado %', v.estado;
  end if;

  update public.visita
  set estado = 'completada',
      comentario = coalesce(nullif(p_comentario, ''), comentario),
      latitud   = coalesce(p_latitud, latitud),
      longitud  = coalesce(p_longitud, longitud),
      completada_en = now()
  where id = v.id
  returning * into v;

  perform public.registrar_auditoria(
    v.tenant_id, 'visita', v.id::text, 'update',
    jsonb_build_object('estado', 'completada')
  );
  return v;
end;
$$;

-- ---------- RPC: aprobar / rechazar (supervisor en la cadena, nunca el dueño) ----------
create or replace function public.visita_revisar(
  p_visita_id          bigint,
  p_aprobada           boolean,
  p_comentario_rechazo text default null
)
returns public.visita
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visita;
begin
  select * into v from public.visita where id = p_visita_id for update;
  if not found then raise exception 'visita no encontrada'; end if;
  if v.usuario_id = auth.uid() then
    raise exception 'el dueño no puede revisar su propia visita';
  end if;
  if v.usuario_id not in (select * from public.subordinados()) then
    raise exception 'solo un supervisor en la cadena ascendente puede revisar';
  end if;
  if v.estado <> 'completada' then
    raise exception 'solo se revisan visitas completadas (estado %)', v.estado;
  end if;
  if not p_aprobada and (p_comentario_rechazo is null or btrim(p_comentario_rechazo) = '') then
    raise exception 'el rechazo exige comentario_rechazo';
  end if;

  update public.visita
  set estado = case when p_aprobada then 'aprobada' else 'rechazada' end,
      revisada_por = auth.uid(),
      revisada_en = now(),
      comentario_rechazo = case when p_aprobada then null else p_comentario_rechazo end
  where id = v.id
  returning * into v;

  perform public.registrar_auditoria(
    v.tenant_id, 'visita', v.id::text, 'update',
    jsonb_build_object('estado', case when p_aprobada then 'aprobada' else 'rechazada' end)
  );
  return v;
end;
$$;

-- ---------- RPC: corregir visita rechazada (vuelve a completada) ----------
create or replace function public.visita_corregir(
  p_visita_id  bigint,
  p_comentario text default null
)
returns public.visita
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visita;
begin
  select * into v from public.visita where id = p_visita_id for update;
  if not found then raise exception 'visita no encontrada'; end if;
  if v.usuario_id <> auth.uid() then
    raise exception 'solo el dueño puede corregir la visita';
  end if;
  if v.estado <> 'rechazada' then
    raise exception 'solo se corrigen visitas rechazadas (estado %)', v.estado;
  end if;

  update public.visita
  set estado = 'completada',
      comentario = coalesce(nullif(p_comentario, ''), comentario),
      revisada_por = null, revisada_en = null, comentario_rechazo = null
  where id = v.id
  returning * into v;

  perform public.registrar_auditoria(
    v.tenant_id, 'visita', v.id::text, 'update',
    jsonb_build_object('estado', 'completada', 'correccion', true)
  );
  return v;
end;
$$;

-- ---------- RPC: anular (dueño o supervisor) ----------
create or replace function public.visita_anular(p_visita_id bigint)
returns public.visita
language plpgsql security definer
set search_path = public
as $$
declare
  v public.visita;
begin
  select * into v from public.visita where id = p_visita_id for update;
  if not found then raise exception 'visita no encontrada'; end if;
  if v.usuario_id <> auth.uid()
     and v.usuario_id not in (select * from public.subordinados()) then
    raise exception 'sin permiso para anular esta visita';
  end if;
  if v.estado in ('anulada','aprobada') then
    raise exception 'transición inválida desde estado %', v.estado;
  end if;

  update public.visita set estado = 'anulada' where id = v.id returning * into v;
  perform public.registrar_auditoria(
    v.tenant_id, 'visita', v.id::text, 'update',
    jsonb_build_object('estado', 'anulada')
  );
  return v;
end;
$$;
