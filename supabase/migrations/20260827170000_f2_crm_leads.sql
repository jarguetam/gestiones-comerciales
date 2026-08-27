-- ============================================================
-- F2.1 — CRM leads (spec db §5.4, backend SPEC GC-CRM-*)
--   lead_origen, lead_estado (embudo configurable por tenant),
--   lead (conexión núcleo: persona_id + asesor_id), lead_actividad
--   + RLS (patrón tenant + alcance por rol, como F1).
-- ============================================================

-- ---------- lead_origen ----------
create table public.lead_origen (
  id        bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  codigo    text not null,                     -- 'referido','campania','walk-in','whatsapp'...
  nombre    text not null,
  activo    boolean not null default true,
  unique (tenant_id, codigo)
);

-- ---------- lead_estado (etapas del embudo, orden configurable) ----------
create table public.lead_estado (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenant(id) on delete cascade,
  codigo     text not null,                    -- 'nuevo','contactado','calificado','ganado','perdido'
  nombre     text not null,
  orden      int not null,                     -- posición en el embudo
  es_ganado  boolean not null default false,   -- dispara conversión a persona/solicitud
  es_perdido boolean not null default false,   -- requiere motivo al entrar
  activo     boolean not null default true,
  unique (tenant_id, codigo)
);

-- ---------- lead ----------
create table public.lead (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  estado_id      bigint not null references public.lead_estado(id),
  origen_id      bigint references public.lead_origen(id),
  nombre         text not null,
  documento      text,
  telefono       text not null,
  email          text,
  municipio_id   bigint references public.municipio(id),
  direccion      text,
  coordenada     geography(point, 4326),
  monto_estimado numeric(18,2),
  detalles       jsonb not null default '{}',  -- atributos específicos del rubro
  -- conexión con el núcleo
  persona_id     bigint references public.persona(id),        -- set al convertir (ganado)
  asesor_id      uuid references public.usuario(id),          -- dueño del lead
  -- trazabilidad del embudo
  perdido_motivo text,
  convertido_en  timestamptz,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.lead (tenant_id, estado_id);
create index on public.lead (asesor_id, creado_en desc);
create index on public.lead (persona_id);
-- GC: sin duplicados por teléfono mientras no esté convertido
create unique index on public.lead (tenant_id, telefono) where persona_id is null;

-- ---------- lead_actividad (historial del embudo) ----------
create table public.lead_actividad (
  id                 bigint generated always as identity primary key,
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  lead_id            bigint not null references public.lead(id) on delete cascade,
  tipo               text not null check (tipo in ('estado','nota','llamada','whatsapp','visita','email')),
  estado_anterior_id bigint references public.lead_estado(id),
  estado_nuevo_id    bigint references public.lead_estado(id),
  descripcion        text,
  realizado_por      uuid not null references public.usuario(id),
  creado_en          timestamptz not null default now()
);
create index on public.lead_actividad (lead_id, creado_en desc);

-- ---------- actualizado_en ----------
create trigger trg_lead_actualizado before update on public.lead
  for each row execute function public.set_actualizado_en();

-- ---------- RLS ----------
alter table public.lead_origen    enable row level security;
alter table public.lead_estado    enable row level security;
alter table public.lead           enable row level security;
alter table public.lead_actividad enable row level security;

-- Catálogos (origen/estado): lectura por tenant; escritura solo admin del tenant
create policy tenant on public.lead_origen
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy gestion on public.lead_origen
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid and (auth.jwt() ->> 'rol') = 'admin')
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid and (auth.jwt() ->> 'rol') = 'admin');

create policy tenant on public.lead_estado
  for select to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
create policy gestion on public.lead_estado
  for all to authenticated
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid and (auth.jwt() ->> 'rol') = 'admin')
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid and (auth.jwt() ->> 'rol') = 'admin');

-- lead: alcance por rol (admin todo; supervisor/gerente subárbol; asesor propio)
create policy alcance_lead on public.lead
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      (auth.jwt() ->> 'rol') = 'admin'
      or asesor_id = auth.uid()
      or asesor_id in (select * from public.subordinados())
    )
  );

-- escritura lead: alta por asesor (dueño) o admin; el estado solo cambia vía RPC
create policy escritura_lead on public.lead
  for insert to authenticated
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (asesor_id is null or asesor_id = auth.uid() or (auth.jwt() ->> 'rol') = 'admin')
  );

-- actualización de campos no-estado (nombre, contacto, monto, detalles) por dueño/admin
create policy actualizar_lead on public.lead
  for update to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      (auth.jwt() ->> 'rol') = 'admin'
      or asesor_id = auth.uid()
      or asesor_id in (select * from public.subordinados())
    )
  )
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- lead_actividad: lectura por alcance del lead; insert por el actor (vía app/RPC)
create policy alcance_lead_actividad on public.lead_actividad
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (
      (auth.jwt() ->> 'rol') = 'admin'
      or exists (
        select 1 from public.lead l
        where l.id = lead_id
          and (l.asesor_id = auth.uid() or l.asesor_id in (select * from public.subordinados()))
      )
    )
  );

create policy insertar_lead_actividad on public.lead_actividad
  for insert to authenticated
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and realizado_por = auth.uid()
  );

-- ---------- grants ----------
grant select on public.lead_origen, public.lead_estado to authenticated;
grant select, insert, update on public.lead to authenticated;
grant select, insert on public.lead_actividad to authenticated;
