# Proposal — habitat-e0-oficina-sin-senal

## Idioma
Todos los artefactos de este cambio se redactan en español.

## Cambio propuesto
Preparar el arranque de Hábitat (Fase 0 y entrega E0 del roadmap `docs/superpowers/specs/2026-11-13-habitat-roadmap-design.md`):
1. Cada actividad se graba con la **oficina y la geografía correctas**, resueltas en el servidor.
2. La app móvil **planifica, hace check-in y cierra sin señal** sin perder registros, y todo se envía una sola vez y en orden al reconectar.

Plan de implementación: `docs/superpowers/plans/2026-11-13-habitat-fase0-e0.md` (Tasks 1 a 10).

## Problema
- **Oficina y geografía arbitrarias** (spec §3, fila 3): toda actividad se graba con la primera zona activa (`cargarDominio.ts:122`, `catalogosCampo.ts:46`) y con un departamento y municipio salidos de consultas `limit(1)` sin orden, que además pueden no cuadrar entre sí. Los reportes por oficina saldrían descuadrados.
- **Sin señal no se trabaja** (spec §3, fila 4): la agenda se lee en vivo (`visitas_del_dia`), los catálogos y clientes también, y el alta llama a `visita_crear` directo (`apps/mobile/src/lib/supabase.ts:91`). Sin señal no se ve la agenda ni se programa.
- **Fallas de la cola descubiertas al planificar:**
  - Cada intento sin señal consume uno de los 5 intentos del ítem; tras días sin cobertura (o con la sesión expirada, `PGRST301`) los ítems se agotan y quedan en error.
  - Cerrar sesión borra la cola local: se pierden los registros sin enviar.
  - Una petición colgada por señal débil bloquea la cola.
  - Un doble toque en «Guardar» podría crear dos actividades.

## Cambio (alcance)
- **Task 1 — DB:** columnas opcionales `zona.departamento_id` y `zona.municipio_id`; `visita_crear` de 13 parámetros (`p_cliente_key`) que resuelve oficina y geografía (parámetro explícito → cliente → oficina del usuario) y es idempotente. Errores `GC-VIS-002` y `GC-VIS-007`.
- **Task 2 — Cola:** los errores de red y de sesión expirada no consumen intentos; `reactivar` ítems agotados (y sus dependientes); `fetchConLimite` de 15 s.
- **Task 3 — Caché de campo** en SQLite particionada por empresa y usuario.
- **Task 4 — Cerrar sesión** conserva los registros sin enviar (con confirmación).
- **Task 5 — Respaldo sin señal** para perfil y catálogos; hasta 2000 clientes en el teléfono.
- **Task 6 — Agenda local** = servidor o caché + cola pendiente, reconciliada por `cliente_key`.
- **Task 7 — Sincronizador:** crea con clave y resuelve visitas locales por `cliente_key`; compatible con ítems encolados por la versión actual.
- **Task 8 — Pantallas móviles** usan cola y caché (`NuevaVisitaModal`, `AgendaScreen`, `SyncScreen`).
- **Task 9 — Web:** deja de mandar oficina y geografía arbitrarias y usa el RPC `visita_crear`.
- **Task 10 — Despliegue** en orden: base de datos → web → APK.
- **Regla de compatibilidad con otras empresas:** si se mandan `p_zona_id`, `p_departamento_id` y `p_municipio_id`, esos ganan. Si el usuario no tiene oficina se usa la primera zona activa por nombre; si nada da geografía, el primer municipio por `id` con su propio departamento (determinista y consistente). Las apps viejas, que no mandan `p_cliente_key`, siguen funcionando. Hábitat no depende de esta regla: su configuración (Parte B del plan) garantiza oficina y municipio.

## Impacto
- **DB:** una migración forward-only (`supabase/migrations/20261114120000_e0_visita_oficina_geo.sql`), reemplazo de firma de `visita_crear` (ya está en el allowlist de `SECURITY DEFINER`), pgTAP nuevo.
- **Móvil:** `apps/mobile` (cola, caché, agenda, sincronización, pantallas, cierre de sesión).
- **Web:** `apps/web` (`persistir`, `cargarDominio`, `catalogos`).
- **Orden de despliegue obligatorio:** la web y la app nuevas mandan `p_cliente_key`; salir antes que la migración las rompe.

## Fuera de alcance
E1 a E7 del roadmap: bandeja de aprobación, tipos de lugar por subactividad, reporte de horas, depósitos completos, geocerca y ubicación del cliente, geografía por país y cartera compartida. Tampoco la Parte B del plan (configuración operativa de Hábitat en producción, sin código) ni la distribución del APK a usuarios.

## Preguntas de aclaración
Ninguna. La pregunta pendiente (si hay zonas sin señal) se respondió el 2026-11-13: sí las hay, por eso el modo sin señal entra completo.
