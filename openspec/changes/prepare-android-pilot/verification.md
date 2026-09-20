# Verificación — primera entrega del piloto

Fecha: 2026-09-20. Base: `466477a`. Rama: `codex/android-pilot`.
Alcance: configuración local/producción; no validación de release Android.

## Regresión
- Primera corrida: 17 tests, 11 fallos esperados (Node 24.7.0 disponible inicialmente).
  Rechazo incorrecto de localhost en móvil, aceptación de backend público en local,
  EAS sin entornos explícitos y jobs staging sin opt-in.
- Segunda regresión: el helper real de credenciales web/backoffice rechazaba
  localhost; 1 fallo antes de corregirlo.
- Después del arreglo: 18/18 tests focalizados pasan con Node 22.14.0.

## Comandos y resultados
Se instaló Node 22.14.0 en un directorio temporal, verificando SHA256 contra
SHASUMS256.txt oficial; Corepack seleccionó pnpm 9.15.9. No cambió el lockfile.

| Comando | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm -r test` | 255 pasan: web 129, backoffice 49, móvil 77 |
| `pnpm test:contracts` | 87 pasan |
| `pnpm -r typecheck` | OK en los tres clientes |
| `pnpm lint` | 0 errores; 3 warnings preexistentes en App, AgendaScreen y PersonaScreen |
| `pnpm --filter @gc/web --filter @gc/backoffice build` | OK ambos |
| `pnpm --filter @gc/web test:e2e` | 36 pasan, 1 omitido: paseo autenticado sin credenciales |
| `pnpm --filter @gc/backoffice test:e2e` | 5 pasan |
| `git diff --check` | OK |

Builds y E2E usan `VITE_ENVIRONMENT=local`, URL `http://127.0.0.1:54321`, clave
placeholder, DSN de prueba y release `ci`, como el CI de fixtures.

Los contratos inicialmente fallaron en 2 tests de Sentry porque `bash` resolvía
al WSL sin distribución funcional (`execvpe /bin/bash failed 2`). Se corrigió
solo el PATH del proceso para usar Git Bash y los 87 pasaron; no se alteraron
los tests ni la configuración global del equipo.

## CI remoto
El PR #71, commit `634d59f`, pasó contratos, lint, seguridad OWASP, CodeQL,
allowlist SECURITY DEFINER, SQL/Edge/builds y pgTAP (blank + replay).
El job EAS Preview se omitió al no tener la etiqueta `android-preview`.
Esto verifica migraciones en CI; el backend local y el dispositivo siguen pendientes.

## No ejecutado / pendiente
- Backend local/pgTAP: Docker no estaba iniciado. `docker info` devolvió
  `open //./pipe/docker_engine: The system cannot find the file specified.`
  No se hicieron migraciones ni cambios a SQL/Edge en esta entrega.
- No se ejecutó un login real ni el recorrido móvil/web contra Supabase.
- Proyecto EAS vinculado y verificado (ver abajo). No se solicitó build cloud,
  firma, submit ni publicación en Play.
- No se ejecutó un build nativo ni Detox: Expo 51/API objetivo, compatibilidad
  de 16 KB y permisos siguen pendientes del siguiente change.
- Producción: no se cambiaron secretos, módulos, datos, workflows remotos ni
  configuración Supabase. El fallo previo de Sentry y backup/restore reales
  siguen pendientes. Los cambios de workflows requieren merge para surtir efecto.

La cuenta personal Play es posterior al 13-11-2023: el usuario lo confirmó.
La prueba cerrada 12 testers/14 días sigue pendiente; prueba interna no la sustituye.

## Vinculación Expo — 2026-09-20
- Sesión EAS CLI iniciada mediante el flujo oficial de navegador.
- Dashboard y `eas project:info` coinciden en
  `@jarguetams-team/gestiones-comerciales-3uncfxmscvb2on8csmb7`, UUID
  `f38df0fe-a2df-464e-95c0-98695be71198`.
- `app.json`: owner, slug y projectId actualizados. Paquete Android `com.gc.mobile` conservado.
- `expo config --type public --json` resuelve esa misma identidad con `app.config.ts`.
- Unitarios móviles: 77/77 pasan. Typecheck móvil y `git diff --check`: OK.
- No se crearon proyectos duplicados, builds ni credenciales de firma.
