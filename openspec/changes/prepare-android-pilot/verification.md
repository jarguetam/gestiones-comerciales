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

## No ejecutado / pendiente
- Backend local/pgTAP: Docker no estaba iniciado. `docker info` devolvió
  `open //./pipe/docker_engine: The system cannot find the file specified.`
  No se hicieron migraciones ni cambios a SQL/Edge en esta entrega.
- No se ejecutó un login real ni el recorrido móvil/web contra Supabase.
- No hay cuenta Expo del propietario. El UUID EAS del repo no se validó.
  No se solicitó build cloud, firma, submit ni publicación en Play.
- No se ejecutó un build nativo ni Detox: Expo 51/API objetivo, compatibilidad
  de 16 KB y permisos siguen pendientes del siguiente change.
- Producción: no se cambiaron secretos, módulos, datos, workflows remotos ni
  configuración Supabase. El fallo previo de Sentry y backup/restore reales
  siguen pendientes. Los cambios de workflows requieren merge para surtir efecto.

La cuenta personal Play es posterior al 13-11-2023: el usuario lo confirmó.
La prueba cerrada 12 testers/14 días sigue pendiente; prueba interna no la sustituye.
