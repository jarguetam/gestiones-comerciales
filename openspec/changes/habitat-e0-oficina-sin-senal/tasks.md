# Tasks — habitat-e0-oficina-sin-senal

> Plan detallado: `docs/superpowers/plans/2026-11-13-habitat-fase0-e0.md`. Rama `habitat/e0-preparacion`.
> Un PR por change. Marcar cada task al cerrarla. La Parte B del plan (configuración de Hábitat en producción) no es parte de este change.

- [ ] 1. DB: `visita_crear` resuelve oficina y geografía y es idempotente (`supabase/migrations/20261114120000_e0_visita_oficina_geo.sql`).
  - Listo cuando: pgTAP `supabase/tests/e0_visita_crear_geo.sql` (7 casos) pasa con `bash scripts/ci/pgtap.sh`, junto con `p0_execute_grants.sql` y `p1_state_machines.sql`.
- [ ] 2. Cola: errores de red no gastan intentos; `reactivar`, `reactivarItem`, `fetchConLimite` (`errorRed.ts`, `fetchLimite.ts`, `cola.ts`, `colaStore.ts`, `supabase.ts`).
  - Listo cuando: `pnpm --filter @gc/mobile test` pasa con las pruebas de `errorRed`, `fetchLimite`, `cola` y `colaStore`.
- [ ] 3. Caché de campo SQLite por sesión (`cacheCampo.ts`, `abrirCache.ts`).
  - Listo cuando: `pnpm --filter @gc/mobile test && pnpm --filter @gc/mobile typecheck` pasan (`cacheCampo.test.ts`).
- [ ] 4. Cerrar sesión conserva los registros sin enviar (`logoutCleanup*.ts`, `App.tsx`).
  - Listo cuando: pasan las pruebas de `logoutCleanup.test.ts` y la existente de partición, y typecheck.
- [ ] 5. Respaldo sin señal: perfil y catálogos (`respaldo.ts`, `catalogosCampo.ts`, `visita.ts`, `supabase.ts`).
  - Listo cuando: pasan `respaldo.test.ts` y `visita.test.ts` (incluido `LIMITE_PERSONAS_CAMPO >= 1000`); typecheck marca los usos viejos de `geo.zonaId` que se corrigen en la Task 8.
- [ ] 6. Agenda local = servidor o caché + cola (`agendaLocal.ts`, `tipos.ts`).
  - Listo cuando: pasa `agendaLocal.test.ts` (10 casos).
- [ ] 7. Sincronizador con clave y resolución de visitas locales (`sync.ts`).
  - Listo cuando: pasa `sync.test.ts` (4 casos, incluida la compatibilidad con ítems de la versión actual).
- [ ] 8. Pantallas móviles usan cola y caché (`NuevaVisitaModal`, `AgendaScreen`, `SyncScreen`; borrar `persistirVisitaCampo`).
  - Listo cuando: `pnpm --filter @gc/mobile typecheck && pnpm --filter @gc/mobile lint && pnpm --filter @gc/mobile test` pasan sin errores.
- [ ] 9. La web deja de mandar oficina y geografía arbitrarias (`persistir.ts`, `persistirHelpers.ts`, `cargarDominio.ts`, `catalogos.ts`, `EmpresaApp.tsx`).
  - Listo cuando: `pnpm --filter @gc/web test && pnpm --filter @gc/web typecheck && pnpm --filter @gc/web test:e2e` pasan.
- [ ] 10. Desplegar en orden: base de datos → web → APK.
  - Listo cuando: CI `validate` en verde; en producción `visita_crear` incluye `p_cliente_key uuid` y `zona` tiene `municipio_id`; la web publicada crea visitas con la oficina del usuario; el build EAS `preview` queda `FINISHED` con enlace de instalación.
  - **E2E del change (dispositivo real):** en modo avión, con la app recién abierta, el asesor ve su agenda, programa una actividad, le hace check-in y la cierra; al reconectar todo llega una sola vez y en orden.
