-- ============================================================
-- F0 · Migración 003 — Tabla de intentos de login (auth-guard)
-- Ref: spec backend §3.1 (rate limit 5 intentos / 15 min)
-- ============================================================

create table if not exists public.auth_attempts (
  id          bigint generated always as identity primary key,
  email       text not null,
  ip          text,
  exitoso     boolean not null default false,
  creado_en   timestamptz not null default now()
);
create index if not exists idx_auth_attempts_email on public.auth_attempts (email, creado_en desc);

-- lectura/escritura solo vía service_role (Edge Function auth-guard)
alter table public.auth_attempts enable row level security;
-- sin políticas: solo service_role puede tocarla
