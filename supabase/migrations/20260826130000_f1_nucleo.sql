-- ============================================================
-- F1 · Migración 004 — Núcleo operativo: persona y dispositivo
-- Ref: spec/db/SPEC.md §4.4, §4.2 (dispositivo) · design D3, G-2
-- usuario, zona, departamento y municipio ya existen desde F0.
-- ============================================================

create extension if not exists postgis;

-- ---------- persona (clientes, prospectos, puntos de venta) ----------
-- Reemplaza al "cliente" del legado: rubro-agnóstico, con atributos
-- específicos del rubro en detalles (jsonb) y registro genérico por asesor (§8).
create table public.persona (
  id                 bigint generated always as identity primary key,
  tenant_id          uuid not null references public.tenant(id),
  codigo_externo     text,
  nombre             text not null,
  documento          text,
  documento_tipo     text not null default 'DNI',
  direccion          text,
  municipio_id       bigint references public.municipio(id),
  coordenada         geography(point, 4326),
  categoria          text,
  asesor_id          uuid references public.usuario(id),
  verificacion_estado text not null default 'pendiente',
  es_registro_generico boolean not null default false,
  detalles           jsonb not null default '{}',
  activo             boolean not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

create index on public.persona (tenant_id);
create index on public.persona (documento);
create index on public.persona (asesor_id);
create unique index on public.persona (tenant_id, documento) where activo and documento is not null;
create index on public.persona using gin (detalles);

-- ---------- dispositivo (tokens FCM para push) ----------
create table public.dispositivo (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null references public.usuario(id) on delete cascade,
  token_fcm     text not null,
  plataforma    text not null check (plataforma in ('android','ios','web')),
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  unique (usuario_id, token_fcm)
);

create index on public.dispositivo (usuario_id);

-- ---------- triggers actualizado_en ----------
create trigger trg_persona_actualizado_en
  before update on public.persona
  for each row execute function public.set_actualizado_en();

-- ---------- RLS ----------
alter table public.persona enable row level security;
alter table public.dispositivo enable row level security;

-- persona: aislamiento por tenant
create policy tenant on public.persona
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- persona: alcance por rol (admin todo; gerente/supervisor subárbol; asesor propio)
create policy alcance_persona on public.persona
  for select to authenticated
  using (
    (auth.jwt() ->> 'rol') = 'admin'
    or asesor_id = auth.uid()
    or asesor_id in (select * from public.subordinados())
  );

-- escritura de persona: admin siempre; asesor solo sobre las suyas (asesor_id = sí mismo)
create policy escritura_persona on public.persona
  for all to authenticated
  using (
    (auth.jwt() ->> 'rol') = 'admin'
    or asesor_id = auth.uid()
    or asesor_id in (select * from public.subordinados())
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      (auth.jwt() ->> 'rol') = 'admin'
      or asesor_id = auth.uid()
      or asesor_id in (select * from public.subordinados())
    )
  );

-- dispositivo: sin tenant_id — alcance por usuario (cada quien sus dispositivos)
create policy propio_dispositivo on public.dispositivo
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- plataforma (superadmin) puede ver dispositivos de usuarios de tenants a su cargo
create policy plataforma_dispositivo on public.dispositivo
  for select to authenticated
  using (public.es_superadmin());

-- ---------- grants ----------
grant select, insert, update, delete on public.persona, public.dispositivo to authenticated;

-- ---------- limpiar guard de admin_importar_personas (F0 lo tenía bloqueado) ----------
-- La tabla existe ahora; la RPC de F0 funciona sin cambios.
