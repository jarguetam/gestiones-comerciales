-- P0-2 / P0-3: producción perdió pg_net (el cron de agenda falla con
-- `schema "net" does not exist`) y el comando del cron guardaba el secreto
-- de notify-jobs en texto plano. El secreto pasa a Vault y se lee al ejecutar.

create extension if not exists pg_net;
create extension if not exists supabase_vault cascade;

do $$
declare
  v_command text;
  v_url text;
  v_secret text;
begin
  select command into v_command
    from cron.job where jobname = 'notify-jobs-recordatorio-agenda';
  if v_command is null then
    -- Local/CI: sin settings de despliegue el job nunca se programó.
    return;
  end if;

  -- Los settings app.* no persisten en producción; el job vigente es la fuente.
  v_url := substring(v_command from $re$url := '([^']+)'$re$);
  v_secret := substring(v_command from $re$'x-notify-secret', '([^']+)'$re$);
  if v_url is null then
    raise exception 'GC-OPS-009: no se pudo leer la URL del job notify-jobs';
  end if;
  if v_secret is null and not exists (select 1 from vault.secrets where name = 'notify_jobs_secret') then
    raise exception 'GC-OPS-009: notify-jobs sin secreto en el job ni en Vault';
  end if;

  if not exists (select 1 from vault.secrets where name = 'notify_jobs_secret') then
    perform vault.create_secret(v_secret, 'notify_jobs_secret',
      'x-notify-secret del cron notify-jobs; rotar junto con NOTIFY_JOBS_SECRET de Edge');
  end if;

  perform cron.schedule(
    'notify-jobs-recordatorio-agenda',
    '30 12 * * *',
    format(
      $job$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-notify-secret',
          (select decrypted_secret from vault.decrypted_secrets where name = 'notify_jobs_secret')
        ),
        body := '{"job":"recordatorio_agenda"}'::jsonb
      )$job$,
      v_url
    )
  );
end
$$;
