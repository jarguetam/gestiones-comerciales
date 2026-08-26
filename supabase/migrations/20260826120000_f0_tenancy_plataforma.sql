-- ============================================================
-- F0 · Migración 001 — Tenancy, plataforma e identidad
-- Gestiones Comerciales · multi-tenant estricto
-- Ref: spec/db/SPEC.md §4.1, §4.2 · design D1, D11
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- tenant (empresa) ----------
create table public.tenant (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,
  nombre         text not null,
  rubro          text not null,
  plan           text not null default 'basico' check (plan in ('basico','pro','enterprise')),
  branding       jsonb not null default '{}',
  configuracion  jsonb not null default '{}',
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------- módulos ----------
create table public.modulo (
  id        bigint generated always as identity primary key,
  codigo    text not null unique,
  nombre    text not null,
  nucleo    boolean not null default false
);

create table public.tenant_modulo (
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  modulo_id      bigint not null references public.modulo(id),
  activo         boolean not null default true,
  configuracion  jsonb not null default '{}',
  primary key (tenant_id, modulo_id)
);

-- ---------- plataforma (backoffice global) ----------
create table public.usuario_plataforma (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  nombre        text not null,
  es_superadmin boolean not null default false,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create table public.usuario_plataforma_tenant (
  usuario_plataforma_id uuid not null references public.usuario_plataforma(id) on delete cascade,
  tenant_id             uuid not null references public.tenant(id) on delete cascade,
  rol                   text not null default 'soporte' check (rol in ('owner','soporte','lectura')),
  creado_en             timestamptz not null default now(),
  primary key (usuario_plataforma_id, tenant_id)
);

-- ---------- usuario de empresa ----------
create table public.usuario (
  id              uuid primary key references auth.users(id) on delete cascade,
  tenant_id       uuid not null references public.tenant(id),
  nombre          text not null,
  telefono        text,
  rol             text not null check (rol in ('admin','gerente','supervisor','asesor')),
  jefe_id         uuid references public.usuario(id),
  zona_id         bigint,
  rastreo_activo  boolean not null default false,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index on public.usuario (tenant_id);
create index on public.usuario (jefe_id);

-- ---------- territorio ----------
create table public.zona (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id),
  codigo    text not null,
  nombre    text not null,
  activo    boolean not null default true
);
create unique index on public.zona (tenant_id, codigo);
alter table public.usuario
  add constraint usuario_zona_fk foreign key (zona_id) references public.zona(id);

-- catálogos geográficos compartidos (sin tenant)
create table public.departamento (
  id     bigint generated always as identity primary key,
  nombre text not null unique
);

create table public.municipio (
  id              bigint generated always as identity primary key,
  departamento_id bigint not null references public.departamento(id),
  nombre          text not null,
  unique (departamento_id, nombre)
);

-- ---------- auditoría ----------
create table public.auditoria (
  id          bigint generated always as identity primary key,
  tenant_id   uuid,
  tabla       text not null,
  registro_id text not null,
  accion      text not null check (accion in ('insert','update','delete')),
  usuario_id  uuid,
  cambios     jsonb not null default '{}',
  creado_en   timestamptz not null default now()
);
create index on public.auditoria (tenant_id, tabla, registro_id);

-- ---------- actualizado_en automático ----------
create or replace function public.set_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger trg_tenant_actualizado before update on public.tenant
  for each row execute function public.set_actualizado_en();
create trigger trg_usuario_actualizado before update on public.usuario
  for each row execute function public.set_actualizado_en();

-- ---------- subárbol del autenticado (requerido por RLS de usuario) ----------
create or replace function public.subordinados()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  with recursive arbol as (
    select u.id, u.rol, u.activo from public.usuario u where u.id = auth.uid()
    union all
    select u.id, u.rol, u.activo
    from public.usuario u
    join arbol a on u.jefe_id = a.id
    where u.activo
  )
  select id from arbol where id <> auth.uid();
$$;

-- ---------- RLS ----------
alter table public.tenant enable row level security;
alter table public.tenant_modulo enable row level security;
alter table public.usuario_plataforma enable row level security;
alter table public.usuario_plataforma_tenant enable row level security;
alter table public.usuario enable row level security;
alter table public.zona enable row level security;
alter table public.departamento enable row level security;
alter table public.municipio enable row level security;
alter table public.auditoria enable row level security;

-- tenant: un usuario solo ve SU tenant; plataforma no ve nada directo (usa RPC admin_*)
create policy tenant_select on public.tenant
  for select to authenticated
  using (id = (auth.jwt() ->> 'tenant_id')::uuid);

-- tenant_modulo: visible para su tenant (feature flags del frontend)
create policy tenant_modulo_select on public.tenant_modulo
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- usuario: admin ve todo el tenant; el resto solo su cadena (subordinados + jefes)
create policy usuario_select on public.usuario
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      (auth.jwt() ->> 'rol') = 'admin'
      or id = auth.uid()
      or jefe_id = auth.uid()
      or id in (select public.subordinados())
    )
  );

-- escritura de usuarios: solo admin del tenant
create policy usuario_insert_admin on public.usuario
  for insert to authenticated
  with check ((auth.jwt() ->> 'rol') = 'admin' and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy usuario_update_admin on public.usuario
  for update to authenticated
  using ((auth.jwt() ->> 'rol') = 'admin' and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy usuario_delete_admin on public.usuario
  for delete to authenticated
  using ((auth.jwt() ->> 'rol') = 'admin' and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- zona: CRUD admin del tenant
create policy zona_admin on public.zona
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- geografía compartida: lectura para autenticados
create policy departamento_select on public.departamento
  for select to authenticated using (true);
create policy municipio_select on public.municipio
  for select to authenticated using (true);

-- plataforma: solo lectura de sí mismo
create policy usuario_plataforma_self on public.usuario_plataforma
  for select to authenticated
  using (id = auth.uid());

-- auditoría: solo lectura para admin del tenant
create policy auditoria_select on public.auditoria
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid and (auth.jwt() ->> 'rol') = 'admin');
