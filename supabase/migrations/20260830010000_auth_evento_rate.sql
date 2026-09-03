-- Gate 1 / Task 13 — auditoría de login y rate limit por IP.

create table if not exists public.auth_evento (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  ip inet,
  email_hash text,
  outcome text not null check (outcome in ('ok', 'fail', 'blocked')),
  request_id text
);

create index if not exists idx_auth_evento_ip_fail
  on public.auth_evento (ip, creado_en desc)
  where outcome in ('fail', 'blocked');

alter table public.auth_evento enable row level security;

revoke all on table public.auth_evento from public, anon, authenticated;
grant all on table public.auth_evento to postgres, service_role;
