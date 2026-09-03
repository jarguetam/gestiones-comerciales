# Panel operativo

Índice de links. No hay dashboard custom.

| Superficie | Dónde |
|---|---|
| Errores cliente | Sentry proyectos web / backoffice / mobile (environment staging\|production) |
| Edge | Supabase Logs; filtrar JSON `request_id`, `fn`, `outcome` |
| CI / probes | Actions: `CI`, `Health probes`, `Backup staging` |
| Play Internal | Play Console → testing interno |
| Migraciones | `pnpm ops:preflight` (`GC-OPS-007` = drift) |
| Brute-force | vista `auth_evento_stats` (service_role; Gate 1 traerá `auth_evento`) |

## Objetivos

- Disponibilidad 99.5%
- RTO 4 h / RPO 1 h
- p95: los límites de las specs de visita, login y sync

Alertas: [incidents.md](../runbooks/incidents.md).
