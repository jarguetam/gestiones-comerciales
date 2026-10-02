# Plan de pase a producción

Fecha de corte: 2026-10-02. Base: `main` @ `3036cc7`. Fuentes: ramas y PRs
abiertos, CI de GitHub, consulta de solo lectura al Supabase productivo
`xcoeipsnykceorcvjwve` y auditoría del repo. Complementa
[golive.md](golive.md) y [production-readiness.md](production-readiness.md);
no los reemplaza.

## 0. Diagnóstico

El sistema **ya opera en producción de hecho** sin haber cerrado el gate:

- El Supabase remoto se declaró producción el 2026-09-20. Hoy tiene 4 tenants,
  8 usuarios (5 admin, 2 asesor, 1 supervisor), 1 usuario de plataforma y datos
  reales mínimos (5 personas, 6 visitas, 1 lead).
- `pages-prod.yml` publica web y backoffice en cada push a `main`.
- `supabase-prod.yml` corrió una vez (2026-09-27, `8b5b957`) y su paso
  `golive-preflight` pasó. La tabla GO/NO-GO de `production-readiness.md` sigue
  en **NO-GO**: el script verifica mucho menos de lo que exige el criterio GO
  (ver §3.4).

Este plan cierra esa brecha antes de abrir el sistema a usuarios de campo.
«Pase a producción» significa aquí: **primer tenant real operando en web,
backoffice y Android, con respaldo restaurable, monitoreo y rollback probados.**

## 1. Estado de ramas contra `main`

| Rama / PR | Commits vs main | Estado | Acción |
|---|---|---|---|
| `codex/android-visit-replay` · #79 (draft) | +1 / −3 | CI verde. Migración `20260926215129_visita_completar_replay.sql`: reintento idempotente de `visita_completar`. **No aplicada en prod.** | **Bloqueante.** Sin ella, una respuesta perdida deja la cola móvil atascada en «transición inválida». Merge de `main`, sacar de draft, merge, `supabase-prod.yml`. |
| `codex/local-email-login` · #80 (draft, base #79) | +1 | `[auth.email] enable_signup = true` solo en `config.toml` local; `[auth] enable_signup = false` mantiene cerrado el registro. CI no corrió (base ≠ main). | Merge tras #79. Confirmar que ningún workflow ejecuta `supabase config push` contra prod (hoy ninguno lo hace). |
| `codex/android-release-readme` · #81 (draft, base #80) | +3 | Docs + `eas.json` submit de `internal` a `alpha` (prueba cerrada). | Merge tras #80. Decidir publicador (ver §7, P2). |
| `dependabot/…multi` · #68 | +4 / −1 | **CI rojo.** React 19.3 en web/backoffice con `react-dom` 18; en móvil rompe el pin SDK 54 (React 19.1.0). | Cerrar. Agregar `ignore` de `react`/`@types/react` en `.github/dependabot.yml` para móvil. |
| `dependabot/…sentry/react-native-7.13.0` · #84 | +1 / −57 | CI verde, pero sale del conjunto Expo SDK 54 (`~7.2.0`). | Cerrar o posponer a la próxima subida de SDK (regla de AGENTS.md). |
| `cursor/agents-md-setup-3a38` | 0 / −70 | Ya mergeada vía #70. | Borrar rama remota. |

Las seis ramas mergean sin conflicto contra `main`. CI de `main` @ `3036cc7`:
verde (6 jobs + CodeQL + Pages + Preflight). Issues abiertos: 0. Releases/tags: 0.

## 2. Hallazgos que bloquean (P0)

Verificados en el proyecto productivo el 2026-10-02.

| # | Hallazgo | Evidencia | Corrección |
|---|---|---|---|
| P0-1 | **`anon` y `authenticated` pueden ejecutar 70 funciones `SECURITY DEFINER`.** Incluye jobs pensados solo para `service_role` (`recordatorio_depositos`, `snapshot_cuentas`) y `registrar_auditoria`, que inserta en `auditoria` con `p_tenant` arbitrario: cualquier usuario autenticado (o quien tenga el anon key y un UUID de tenant) puede falsificar auditoría de otro tenant. | `has_function_privilege('anon', …) = true`. Las migraciones hacen `revoke … from public`, pero Supabase concede `execute` a `anon`/`authenticated` por default privileges en `public`. | Migración nueva: `revoke execute … from anon, authenticated` en jobs, triggers y helpers internos; `alter default privileges in schema public revoke execute on functions from anon, authenticated`; re-`grant` explícito solo a las RPC de cliente. pgTAP que recorra `pg_proc` y falle si una `SECURITY DEFINER` es ejecutable por `anon` fuera de una allowlist. |
| P0-2 | **`pg_net` no está instalado**; `notify-jobs-recordatorio-agenda` falla 7/7 días (`schema "net" does not exist`). Drift respecto de `20260827160000`. | `pg_extension` sin `pg_net`; `cron.job_run_details`. | Migración `create extension if not exists pg_net with schema extensions;` y redefinir el job. Investigar por qué falta (¿se desactivó desde el dashboard?). |
| P0-3 | **Secreto de `notify-jobs` en texto plano** dentro de `cron.job.command`; Vault vacío (0 secretos, incluido el que crea `20260830013000_plataforma_aal2.sql`). | Consulta a `cron.job` y `vault.secrets`. | Guardar el secreto en Vault, leerlo con `vault.decrypted_secrets` en el comando del job, **rotar** `NOTIFY_JOBS_SECRET` en Edge. |
| P0-4 | **Sin respaldo restaurable verificado.** PITR nunca verificado; no hay dump de prod; `restore-staging-dryrun.sh` dice «restore real no implementado». `ops-backup-staging.yml` falla todas las semanas y no está detrás de `ENABLE_STAGING`. | Workflows y scripts. | Ver §3.1. |
| P0-5 | **Auth productivo sin configurar para usuarios reales.** `configure-supabase-project.ts` valida variables pero no aplica nada; `config.toml` tiene `site_url`/redirects de localhost. Invitaciones y recuperación de contraseña dependen de SMTP + URLs correctas. | Script y `config.toml`. | Ver §3.2. |
| P0-6 | **Pantallas simuladas en módulos optativos.** `SolicitudesScreen` envía una firma PNG 1×1 fija y un adjunto falso; `DepositosScreen` no sube la foto; `NewEventModal` (web) cae a catálogos y asistentes de demo (`eventsData.ts`) si el tenant no tiene catálogos. | `apps/mobile/src/screens/*.tsx`, `apps/web/src/features/calendar/components/NewEventModal.tsx:44-56,167`. | `solicitudes` y `depositos` **desactivados** en el tenant piloto. Quitar el fallback de `NewEventModal` (bugfix: estado vacío + `GC-*`, con test). |
| P0-7 | **Pages despliega sin esperar CI** y sin coordinarse con las migraciones. | `pages-prod.yml`: `on: push` sin `needs`/`workflow_run`. | Cambiar a `workflow_run` de `CI` con `conclusion == 'success'`; para cambios con migración, desplegar Supabase antes del merge de UI (expand primero). |

## 3. Trabajo por frente

### 3.1 Respaldo y recuperación (P0-4)

1. Confirmar plan Supabase del proyecto (PITR exige Pro + add-on). Si no hay
   PITR, la alternativa mínima es un dump diario cifrado (ver 3).
2. `enable-pitr.ts` con token `projects:write`; registrar retención (≥ 7 d).
3. Workflow nuevo `ops-backup-prod.yml`: `supabase db dump` (schema + data,
   roles aparte) diario, artifact cifrado o bucket externo, retención 14 d.
   Respaldo **fuera** de Supabase: un incidente de cuenta no debe llevarse
   también el backup.
4. Implementar el restore real en un proyecto scratch (nunca en
   `xcoeipsnykceorcvjwve`): dump o PITR → restore → `select count(*)` por tabla
   clave → login de una cuenta sintética → borrar scratch. Medir RTO real
   contra el objetivo 4 h. Adjuntar log al PR de go-live.
5. Desactivar `ops-backup-staging.yml` mientras no exista staging (hoy falla
   cada domingo y genera ruido).

### 3.2 Auth, correo y URLs (P0-5)

1. SMTP productivo (dominio corporativo, SPF/DKIM/DMARC). Límite de envío
   adecuado a invitaciones masivas.
2. `site_url` = URL pública de web; redirect URLs: web, backoffice, `gc://recuperar`.
3. Completar `configure-supabase-project.ts` para que aplique (PATCH) y
   verifique; hoy solo lee. Alternativa explícita: configuración manual con
   captura en el PR, y el script en modo verificación.
4. `check-auth-hook.ts` con token: confirmar `custom_access_token_hook` activo.
5. Activar protección de contraseñas filtradas (Pro) y revisar rate limits de Auth.
6. MFA: hoy 1 de 8 usuarios. Confirmar que el usuario de plataforma tiene AAL2
   y exigir MFA a admins de tenant antes del go-live.

### 3.3 Base de datos y Edge

1. Migraciones P0-1, P0-2, P0-3 + #79, en un solo lote probado con pgTAP
   (blank + replay) en CI.
2. Secrets de Edge en prod: `NOTIFY_JOBS_SECRET` (rotado), `FIREBASE_SERVICE_ACCOUNT`,
   `ALLOWED_ORIGIN` (hoy CORS cae a `*` si falta, `_shared/cors.ts:7`).
   Corregir docs que nombran `GOOGLE_SERVICE_ACCOUNT_KEY`.
3. Buckets `firmas`, `documentos`, `importes`: `file_size_limit` y
   `allowed_mime_types`.
4. Advisors: `function_search_path_mutable` (6 funciones) en la misma migración.
   `spatial_ref_sys`/PostGIS en `public` y rendimiento (38 políticas initplan,
   33 FK sin índice): no bloquean con el volumen actual; agendar post go-live.
5. HMAC de webhook: 0 tenants con secreto. Si el piloto no usa webhook, dejarlo
   apagado; si lo usa, rotar con `rotate-webhook-secret.ts` y entregar una vez.
6. Restringir la API key de Firebase Android (`restrict-firebase-android-key.ts`).
7. Fijar `esm.sh/@supabase/supabase-js@2` a versión exacta.

### 3.4 Gate y pipeline (P0-7)

`golive-preflight.ts` hoy solo exige CI + pgTAP del SHA, probe < 1 h, variables
Sentry, sin `DEMO_MODE` en `apps/web/src` y sin `.apk`. Para que `ready: true`
signifique algo, agregar:

- drift de migraciones (`preflight.ts`, `GC-OPS-007`);
- PITR activo o último dump de prod < 26 h;
- auth hook activo y SMTP configurado;
- `DEMO_MODE` en los tres `apps/*/src`, `.aab` versionados;
- jobs `cron` con última ejecución exitosa (cubre P0-2).

Además:

- `supabase-prod.yml`: `supabase db push --dry-run` y salida en el resumen antes
  del push real; fijar versión de Supabase CLI (hoy `latest`) y de `eas-cli`.
- Environment `production`: **reviewers obligatorios y branch policy `main`**.
  No se pudo verificar (403). Si el único reviewer posible es quien dispara el
  workflow, el control es nominal: ver P1 en §7.
- Probe PostgREST: `rpc/now` no existe (404 pasa por `< 500`). Reemplazar por
  una RPC/vista real de salud. GitHub ejecuta el cron `*/15` cada 3–7 h: lanzar
  el probe manualmente antes de `ops:golive`.
- Alertas: hoy solo issues `ops-alert`. Agregar Sentry alert rules a correo/Teams
  para errores nuevos y caída de probes.

### 3.5 Datos y onboarding

1. Bootstrap documentado del superadmin de plataforma (hoy no existe runbook).
2. Catálogos globales en prod: 6 módulos OK. **Geografía: 22 departamentos y 12
   municipios (seed parcial de Guatemala).** Si el piloto es hondureño, cargar
   geografía de Honduras (18 departamentos, 298 municipios) vía backoffice P-05
   o migración de datos; si es guatemalteco, completar los 340 municipios.
3. Limpieza de tenants: hay 4 activos («Gestiones Comerciales», «PRIVATE»,
   «Hábitat para la Humanidad Honduras», «Piloto Gestiones Comerciales»).
   Marcar cuáles son de prueba, desactivarlos o renombrarlos; no mezclar
   cuentas de prueba con el tenant real.
4. Tenant piloto: crear con `WizardEmpresa`, módulos `core` (+ `crm` si aplica),
   jerarquía admin → supervisor → asesores (PR #86 exige supervisor), catálogos,
   al menos una plantilla de formulario, importación CSV de personas.
5. Carga inicial de datos del cliente: solo personas tiene UI de importación.
   Cuentas y catálogos por Edge `importer` sin UI: decidir si se cargan por
   script o se posponen.

### 3.6 Android

1. Environment `eas-android` + `EXPO_TOKEN`; `SENTRY_AUTH_TOKEN` en EAS
   `production`; cuenta de servicio de Play en EAS Submit.
2. Build `production` con mapas Sentry; instalar desde Play (prueba interna).
3. Smoke en dispositivo real (pendientes de `upgrade-android-sdk54` y
   `prepare-android-pilot`): login, aviso y permiso de ubicación (denegar y
   conceder), agenda, visita offline → matar app → reabrir → sync, formulario,
   notificación push, `gc://recuperar`, logout limpia cola.
4. Play Console: ficha, Data safety, declaración de ubicación en segundo plano
   + video, foreground service, cuenta de revisor, capturas reales.
5. **Cuenta personal posterior al 13-11-2023: prueba cerrada con ≥ 12 testers
   durante 14 días continuos antes de solicitar producción.** Es el camino
   crítico del calendario.
6. Detox: hoy `detox-android.yml` solo verifica archivos. No bloquea si el smoke
   manual se registra con evidencia por build.

### 3.7 Documentación y limpieza

- Actualizar `production-readiness.md` (tabla GO/NO-GO, Gate 2 sin staging),
  `privacy-policy-draft-es.md` (ya publicada en `privacidad.html`),
  `releases/README.md` (describe un APK demo que ya no existe), tasks de
  `upgrade-android-sdk54` ya cumplidas.
- `SECURITY.md` sin correo de contacto.
- Lint: 2 warnings en móvil.

## 4. Secuencia y calendario

Fechas tentativas; el camino crítico es la prueba cerrada de Play (14 días).

| Fase | Ventana | Contenido | Salida |
|---|---|---|---|
| F0 Limpieza | 05-10 | §1: cerrar #68/#84, borrar rama obsoleta, rebase/merge #79→#80→#81. Decisiones de §7. | `main` con #79–#81; decisiones registradas. |
| F1 Seguridad DB | 05–08-10 | P0-1, P0-2, P0-3, §3.3 (1–4). Un PR, pgTAP. | Migraciones aplicadas con `supabase-prod.yml`; advisors sin `anon_security_definer` fuera de la allowlist; cron verde 2 días seguidos. |
| F2 Operación | 05–09-10 | §3.1, §3.2, §3.4. | PITR/dump verificado, restore real con log, SMTP + URLs, gate reforzado, reviewers en `production`. |
| F3 App | 06–09-10 | P0-6 (`NewEventModal`), §3.6 (1–3). | AAB `production` instalado desde prueba interna; smoke registrado. |
| F4 Datos piloto | 08–12-10 | §3.5. Usuarios reales con MFA (admins). | Tenant piloto listo; tenants de prueba aislados. |
| F5 Ensayo | 12-10 | Ensayo completo del día D con cuentas sintéticas en el tenant piloto + restore drill. | Checklist §5 ejecutado de punta a punta sin desvíos. |
| **D** | **13-10** | Go-live web/backoffice + Android en prueba cerrada para el equipo de campo (≥ 12 testers). | `ops:golive` `ready: true`; tabla GO/NO-GO firmada. |
| F6 Hipercuidado | 13–27-10 | Seguimiento diario (§6). Prueba cerrada corriendo. | 14 días de prueba cerrada sin P0/P1 abiertos. |
| F7 Play producción | desde 28-10 | Solicitud de acceso a producción + revisión de Google (días a semanas). | App en track de producción. |

Si F1 o F2 se atrasan, D se mueve. **No** se adelanta D quitando ítems P0.

## 5. Checklist del día D

**Congelamiento:** sin merges a `main` desde D−1 18:00 salvo el SHA candidato.

1. Comunicar ventana a admins del tenant piloto.
2. `workflow_dispatch` de Health probes; esperar verde.
3. `pnpm ops:golive` en el SHA candidato → `ready: true`. Guardar salida.
4. Backup previo: dump manual de prod + marca de tiempo PITR anotada.
5. `supabase-prod.yml` con el SHA (reviewer distinto del ejecutor) — revisar
   `db push --dry-run` antes de aprobar.
6. Verificar: migraciones = repo; 8 Edge activas; `cron.job_run_details` sin
   fallos; advisors de seguridad sin ERROR nuevos.
7. Pages: confirmar que el despliegue corresponde al SHA; `pages-smoke.sh`.
8. Sentry: release `web@SHA` / `backoffice@SHA` finalizado; evento `gate6-ping`
   recibido y borrado.
9. Smoke funcional con cuentas reales del piloto (sin datos inventados):
   login admin con MFA → crear asesor (invitación por correo llega) →
   asesor en Android: agenda, visita, formulario offline, sync → supervisor la
   ve en web → auditoría registra el cambio.
10. Promover el AAB a prueba cerrada y enviar invitaciones a testers.
11. Actualizar tabla GO/NO-GO en `production-readiness.md` con run IDs.

**NO-GO inmediato** (además de los de [golive.md](golive.md)): cualquier P0 de
§2 abierto; restore real sin log; `ready: false`; invitación por correo que no
llega; sync móvil que deja la cola con errores.

## 6. Rollback y hipercuidado

- **Web/backoffice:** re-run de `pages-prod.yml` en el SHA anterior.
- **Edge:** `supabase-prod.yml` con el SHA anterior (solo funciones si la DB no cambió).
- **DB:** sin down-migrations. Migración correctiva forward; ante corrupción de
  datos, PITR al timestamp anotado en D-4 (pérdida aceptada ≤ RPO 1 h, avisando
  al cliente). Decide: responsable técnico + responsable del cliente.
- **Android:** detener el release en Play; los testers conservan el build anterior.
- **Secretos:** [secrets-rotation.md](secrets-rotation.md).

Hipercuidado (14 días): revisión diaria de Sentry (web, backoffice, mobile),
`cron.job_run_details`, logs Edge 5xx, `auth_evento_stats`, cola móvil con
errores reportados por asesores. Canal único de reporte para el cliente y
tiempo de respuesta acordado (§7, P4).

## 7. Decisiones pendientes

| # | Pregunta | Default si no hay respuesta |
|---|---|---|
| P1 | ¿Quién es el segundo reviewer del Environment `production`? Con un solo desarrollador, «reviewers obligatorios» no es un control real. | Designar un segundo aprobador (aunque no sea desarrollador) para `supabase-prod.yml`. |
| P2 | Play, privacidad y Pages están bajo cuenta personal (`jarguetam.github.io`, gmail personal). ¿El sistema es de una empresa? Si sí, la titularidad de la app, la política y el dominio deberían ser corporativos **antes** de publicar: transferir una app de Play después es posible pero lento, y la URL de privacidad queda en la ficha. | Mantener cuenta personal para la prueba cerrada; decidir titularidad antes de F7. |
| P3 | ¿Cuál es el tenant piloto y de qué país? Define la geografía a cargar (§3.5). | «Hábitat para la Humanidad Honduras» con geografía de Honduras; solo `core`. |
| P4 | ¿SLA y canal de soporte para el piloto? | Horario laboral, respuesta < 4 h, canal único. |
| P5 | ¿Plan Supabase actual? PITR y protección de contraseñas filtradas requieren Pro. | Pasar a Pro con PITR 7 d antes de D. |
| P6 | Staging se declaró optativo. Con migraciones forwards-only sobre datos reales, ¿se acepta probar solo en local? | Proyecto scratch temporal (o Supabase branch) para el lote F1 y el restore drill; se borra después. |
| P7 | ¿El piloto necesita `crm`, webhook o importación de cuentas? | No: solo `core`; webhook apagado. |

## 8. Fuera de alcance

iOS; completar `solicitudes`/`depositos`/`creditos`/`kilometraje`; optimización
de RLS/índices; paging 24/7; Detox en CI.
