# Gate 5 checklist

- [ ] Sentry `gate5-ping` en staging y se borra
- [ ] Cron health (`ops-health.yml`) verde
- [ ] PITR `retentionDays >= 7` (`scripts/ops/enable-pitr.ts`)
- [ ] Backup artifact `backup-staging` existe
- [ ] Privacidad publicada (`privacidad.html` + link en login)
- [ ] PR `cursor/gate-5-ops-67a2`

Dependencias abiertas: Gate 1 (`auth_evento` nativo) sigue en draft CONFLICTING; `auth_evento_stats` lee `auth_attempts` hasta ese merge. Gate 3/4 deben mergearse para Sentry de cliente y builds reales; este gate no cierra el programa hasta entonces.
