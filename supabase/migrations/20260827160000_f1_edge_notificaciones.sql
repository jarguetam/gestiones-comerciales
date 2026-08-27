-- ============================================================
-- F1.9 — Edge Functions: notificaciones in-app + pg_cron/pg_net
--   - tabla public.notificacion (degradación de push-notifications, §4.3)
--   - extensiones pg_cron y pg_net para programar notify-jobs (§7)
-- ============================================================

-- ---------- extensiones ----------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- notificacion (in-app; la llena push-notifications con service_role) ----------
create table public.notificacion (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  usuario_id  uuid not null references public.usuario(id) on delete cascade,
  titulo      text not null,
  cuerpo      text not null,
  datos       jsonb not null default '{}',
  canal       text not null default 'in_app' check (canal in ('push','in_app','email')),
  leida       boolean not null default false,
  creado_en   timestamptz not null default now()
);

create index on public.notificacion (usuario_id, leida, creado_en desc);
create index on public.notificacion (tenant_id);

alter table public.notificacion enable row level security;

-- lectura: cada usuario ve solo las suyas dentro de su tenant
create policy tenant on public.notificacion
  for select to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and usuario_id = auth.uid()
  );

-- marcar como leída: solo el dueño
create policy lectura_propia on public.notificacion
  for update to authenticated
  using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and usuario_id = auth.uid()
  )
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and usuario_id = auth.uid()
  );

-- (sin policy de insert para authenticated: solo service_role desde push-notifications)

-- ---------- pg_cron → notify-jobs ----------
-- El cron solo se programa si la base tiene configurados los ajustes de despliegue:
--   alter database postgres set app.edge_base_url = 'https://<proyecto>.supabase.co';
--   alter database postgres set app.notify_jobs_secret = '<secreto>';
-- Así la migración es segura en local/CI (sin esos settings no hace nada).
do $$
declare
  v_url text := current_setting('app.edge_base_url', true);
  v_secret text := current_setting('app.notify_jobs_secret', true);
begin
  if v_url is not null and v_secret is not null then
    -- 12:30 UTC = 06:30 Guatemala: recordatorio de agenda del día siguiente
    perform cron.schedule(
      'notify-jobs-recordatorio-agenda',
      '30 12 * * *',
      format(
        $job$select net.http_post(
          url := %L,
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', %L),
          body := '{"job":"recordatorio_agenda"}'::jsonb
        )$job$,
        v_url || '/functions/v1/notify-jobs',
        v_secret
      )
    );
  else
    raise notice 'notify-jobs: app.edge_base_url/app.notify_jobs_secret no configurados; cron omitido';
  end if;
exception
  when others then
    raise notice 'notify-jobs: no se pudo programar el cron (%). Continúa la migración.', sqlerrm;
end $$;
