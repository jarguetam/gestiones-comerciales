# Cron

Jobs: `notify-jobs` (pg_cron + pg_net), `purgar-rastreo-180d` (domingo 04:15), `compactar-auditoria-anual` (1 ene 04:30), dump staging semanal.

Si un job falta:

1. `admin_salud_jobs` / P-06 salud de plataforma.
2. `cron.job` en staging vs prod (mismo schedule).
3. Secret `NOTIFY_JOBS_SECRET` alineado con Edge.
4. Probe `ops-health.yml` no cubre cron; mirar `docs/ops/panel.md` y logs de `notify-jobs`.
