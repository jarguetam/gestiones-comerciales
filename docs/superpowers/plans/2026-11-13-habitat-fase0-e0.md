# Hábitat — Fase 0 y E0 (oficina correcta y modo sin señal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar listo el arranque de Hábitat. Cada actividad debe grabarse con la oficina y la geografía correctas, y la app debe planificar, hacer check-in y cerrar sin señal sin perder registros. Además, la empresa queda configurada en producción.

**Architecture:**
- **Servidor.** `visita_crear` resuelve oficina y geografía en orden: parámetro explícito → cliente → oficina del usuario. Además es idempotente por `p_cliente_key`.
- **App.** Todo alta pasa por la cola local. Los errores de red no consumen intentos. Catálogos y agenda se guardan en una caché SQLite particionada por sesión, y la agenda en pantalla resulta de servidor/caché + cola pendiente. Cerrar sesión se bloquea si queda algo sin enviar.
- **Web.** Deja de mandar oficina y geografía arbitrarias.
- **Parte B.** Configuración operativa de la empresa, sin código.

**Tech Stack:** PostgreSQL 17 / Supabase (RPC, pgTAP), React Native + Expo SDK 54 (`expo-sqlite`, `expo-crypto`), React + Vite (web), `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-13-habitat-roadmap-design.md` (§8 Fase 0 y E0; §6 y §7 para la Parte B).

## Global Constraints

- Node `22.14.0`, pnpm `9.15.9`. Sin dependencias nuevas: `expo-sqlite`, `expo-crypto` y `node:sqlite` (pruebas) ya están.
- Migraciones forward-only con nombre lexicográfico en `supabase/migrations/`. Toda `SECURITY DEFINER` nueva va en `supabase/tests/security_definer_allowlist.txt` y se le revoca `execute` a `public` y `anon`.
- Errores al usuario con código `GC-*`. Prohibido tragar errores o usar valores por defecto que oculten fallas (`AGENTS.md`). La caché solo se usa ante error de red, y la UI siempre dice de cuándo es el dato.
- **Compatibilidad con otras empresas:** si se mandan `p_zona_id`, `p_departamento_id` y `p_municipio_id`, esos ganan. Las apps viejas, que no mandan `p_cliente_key`, siguen funcionando.
- **Nada se borra de la cola sin confirmación del servidor** (spec E0).
- Pruebas: unitarias con `node:test` (`node --experimental-strip-types --test`), sin RTL. SQL con pgTAP. UI móvil con `components/ui` + `useTheme()`.
- Commits: asunto imperativo de ≤50 caracteres, sin punto final. Terminar con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Rama: `habitat/e0-preparacion`, en el worktree `C:\Users\josue.argueta\source\repos\gestiones-comerciales-habitat`, sin upstream. En esta PC no hay `gh`: el PR se abre desde GitHub.

## Review Focus

1. **Sesión expirada al reconectar** tras días sin señal (`PGRST301`, «JWT expired»). Los ítems no deben agotarse mientras el cliente refresca el token. *Prueba en Task 2.*
2. **Doble toque en «Guardar»** al programar sin señal. Debe quedar una sola actividad. *Prueba en Task 2 y regla en Task 8.*
3. **Asesor con más de 200 clientes.** Sin señal deben estar todos sus clientes, no solo los primeros 200 por nombre. *Prueba en Task 5.*
4. **Ítems ya encolados por la versión actual de la app** (`visita_checkin:<id>`, solo con `visitaId`). Deben sincronizar después de actualizar. *Prueba en Task 7.*
5. **Asesor sin oficina asignada.** Con la regla de compatibilidad, su actividad caería en la primera oficina y descuadraría el reporte. Se previene en la configuración. *Consulta en Task 11 y prueba de la regla en Task 1.*

**Fuente de verdad:** este archivo en el worktree `gestiones-comerciales-habitat`. La copia en `C:\Proyectos\gestiones-comerciales\docs\` es solo para leer.

---

## Parte A — Código (E0)

### Task 0: OpenSpec del cambio y documentos

**Files:**
- Create: `openspec/changes/habitat-e0-oficina-sin-senal/proposal.md`
- Create: `openspec/changes/habitat-e0-oficina-sin-senal/specs/visitas/spec.md`
- Create: `openspec/changes/habitat-e0-oficina-sin-senal/tasks.md`
- Ya copiados: `docs/superpowers/specs/2026-11-13-habitat-roadmap-design.md` y este plan

- [ ] **Step 1: Escribir `proposal.md`** con el formato de `openspec/changes/add-core-platform/proposal.md`:
  - **Problema:** spec §3, filas 3 y 4, y las fallas de cola descubiertas al planificar (5 intentos sin señal; el logout borra la cola).
  - **Cambio:** las Tasks 1 a 10. Incluye la regla de compatibilidad de oficina y geografía para las otras empresas.
  - **Fuera de alcance:** E1 a E7.
  - **Preguntas de aclaración:** ninguna. La señal se respondió el 2026-11-13.
- [ ] **Step 2: Escribir `specs/visitas/spec.md`** con escenarios WHEN/THEN, uno por cada prueba de las Tasks 1, 2, 6 y 7.
- [ ] **Step 3: Escribir `tasks.md`** con las Tasks 1 a 10 y su criterio de «listo».
- [ ] **Step 4: Commit**

```bash
git add openspec/changes/habitat-e0-oficina-sin-senal docs/superpowers
git commit -m "docs: add Habitat roadmap and E0 change"
```

### Task 1: `visita_crear` resuelve oficina y geografía y es idempotente

**Files:**
- Create: `supabase/migrations/20261114120000_e0_visita_oficina_geo.sql`
- Create: `supabase/tests/e0_visita_crear_geo.sql`

**Interfaces:**
- Produces:
  - Columnas `public.zona.departamento_id bigint null → departamento(id)` y `public.zona.municipio_id bigint null → municipio(id)`.
  - `public.visita_crear(p_persona_nombre text, p_actividad_id bigint, p_sub_actividad_id bigint, p_actividad_hora_id bigint, p_zona_id bigint, p_departamento_id bigint, p_municipio_id bigint, p_fecha date, p_hora_inicio time, p_persona_id bigint default null, p_direccion text default null, p_comentario text default '', p_cliente_key uuid default null) returns public.visita`
  - Errores nuevos: `GC-VIS-002: la empresa no tiene oficinas activas` y `GC-VIS-007: clave de cliente en uso`.
  - **Regla de compatibilidad** para otras empresas, cuyos usuarios pueden no tener oficina y cuyas zonas pueden no tener municipio (el asistente crea «Zona 1» sin geografía):
    - Si el usuario no tiene oficina, se usa la primera zona activa de la empresa por nombre. Es lo que hacían la web y la app.
    - Si nada da geografía, se usa el primer municipio por `id` y su propio departamento. Antes el par salía de dos consultas `limit(1)` independientes que podían no cuadrar; ahora es determinista y consistente.
    - Hábitat no depende de esta regla: la configuración y la verificación de la Task 11 garantizan oficina y municipio.

- [ ] **Step 1: Escribir la prueba pgTAP** `supabase/tests/e0_visita_crear_geo.sql`.
  - Formato: `begin; select plan(7); … rollback;`. Usa los fixtures de `000_setup_tests.sql` y `tests.set_claims(tenant, rol, uid)`.
  - **Preparación:** crear `departamento` «E0 Depto A» con su municipio «E0 Muni A», y «E0 Depto B» con «E0 Muni B». Asignar a la zona `Z1` del tenant `1111…` el Depto A / Muni A. Al asesor A (`aaaaaaaa-…-0004`) ponerle `zona_id` = esa zona. A la persona «Finca T1», `municipio_id` = Muni B.
  - **Casos** (todas las llamadas como asesor A, salvo los que dicen otra cosa):
    1. Sin cliente y con oficina y geografía en `null` → la visita queda con `zona_id` = Z1(T1), `municipio_id` = Muni A, `departamento_id` = Depto A.
    2. Con `p_persona_id` = Finca T1 → `municipio_id` = Muni B, `departamento_id` = Depto B, `zona_id` = Z1(T1).
    3. Con oficina y geografía explícitas (Muni A) y `p_persona_id` = Finca T1 → `municipio_id` = Muni A (el parámetro explícito gana).
    4. Como asesor B (`…-0005`, sin zona), sin parámetros → la visita queda en Z1(T1), la primera zona activa, y su `departamento_id` es el departamento de su `municipio_id` (regla de compatibilidad). Además, como asesor T2 tras desactivar la única zona de T2 en el mismo test → `throws_ok` que empieza en `GC-VIS-002`.
    5. Dos llamadas con el mismo `p_cliente_key` → `count(*) = 1` para esa clave.
    6. La segunda llamada devuelve el mismo `id` que la primera.
    7. Como asesor B, con la clave del caso 5 → `throws_ok` que empieza en `GC-VIS-007`.
- [ ] **Step 2: Correrla y verla fallar**
  Run: `bash scripts/ci/pgtap.sh` (requiere Docker y la CLI de Supabase)
  Expected: FAIL en `e0_visita_crear_geo.sql`, porque la columna `zona.municipio_id` no existe.
- [ ] **Step 3: Escribir la migración.**
  - `alter table public.zona add column departamento_id …, add column municipio_id …`.
  - `drop function public.visita_crear(text, bigint, bigint, bigint, bigint, bigint, bigint, date, time, bigint, text, text);` y crear la de 13 parámetros. Sin el `drop`, una llamada con nombres sin `p_cliente_key` sería ambigua.
  - Conservar todas las validaciones de la versión en `20260829010000_rls_jwt_app_metadata.sql`.
  - **Orden de resolución:**
    1. *Replay:* si `p_cliente_key` no es nulo y ya existe una visita con esa clave, se devuelve si es del mismo usuario; si es de otro, `GC-VIS-007`.
    2. `zona := coalesce(p_zona_id, usuario.zona_id, primera zona activa de la empresa por nombre)`. Si sigue nula → `GC-VIS-002`.
    3. `municipio := coalesce(p_municipio_id, persona.municipio_id, zona.municipio_id, primer municipio por id)`. La persona se lee filtrando `tenant_id = v_tenant`.
    4. `departamento := coalesce(p_departamento_id, departamento del municipio resuelto)`.
  - Antes de escribir, `rg -n "visita_crear" supabase/tests apps` para ubicar llamadas con la firma vieja. Al planificar solo apareció el allowlist.
  - Insertar con `cliente_key = coalesce(p_cliente_key, gen_random_uuid())`.
  - `revoke all … from public, anon; grant execute … to authenticated;`. `public.visita_crear` ya está en el allowlist.
- [ ] **Step 4: Correr pgTAP y verla pasar**
  Run: `bash scripts/ci/pgtap.sh`
  Expected: `OK: pgTAP blank + replay`. Las suites existentes también pasan, incluidas `p0_execute_grants.sql` y `p1_state_machines.sql`.
- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261114120000_e0_visita_oficina_geo.sql supabase/tests/e0_visita_crear_geo.sql
git commit -m "feat(db): resolve visit office and geo server-side"
```

### Task 2: La cola no gasta intentos sin señal y se puede reactivar

**Files:**
- Create: `apps/mobile/src/lib/errorRed.ts`, `apps/mobile/src/lib/fetchLimite.ts`
- Modify: `apps/mobile/src/lib/cola.ts` (`procesarCola`, más funciones nuevas)
- Modify: `apps/mobile/src/lib/colaStore.ts` (agregar `reactivarItem`)
- Modify: `apps/mobile/src/lib/supabase.ts` (`createClient` con `global: { fetch: fetchConLimite(15_000) }`)
- Test: `apps/mobile/tests/errorRed.test.ts`, `apps/mobile/tests/fetchLimite.test.ts`, `apps/mobile/tests/cola.test.ts`, `apps/mobile/tests/colaStore.test.ts`

**Interfaces:**
- Produces:
  - `esErrorTransitorio(err: unknown): boolean` (en `errorRed.ts`).
  - En `cola.ts`:
    - `marcarSinRed(items: ItemCola[], id: string, ahora?: number): ItemCola[]`
    - `reactivar(items: ItemCola[], id: string): ItemCola[]`
    - `sinEnviar(items: ItemCola[]): number`
    - `ESPERA_SIN_RED_MS = 15_000`
  - `reactivarItem(id: string, clave?: string): Promise<void>` (en `colaStore.ts`).
  - `fetchConLimite(ms: number, base?: typeof fetch): typeof fetch` (en `fetchLimite.ts`). Con señal débil una petición colgada bloquearía la cola, porque `sincronizarAhora` reutiliza el envío en curso. Al vencer el tiempo aborta con un error que `esErrorTransitorio` reconoce.
  - `reactivar` también reactiva los ítems dependientes: los que tienen `payload.visitaClienteKey` igual a `payload.clienteKey` del ítem `visita` reactivado. Si el servidor rechazó el alta, su check-in y su cierre murieron con `GC-SYNC-001`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// errorRed.test.ts
for (const [err, esperado] of [
  [{ message: 'TypeError: Network request failed' }, true],
  [new TypeError('Failed to fetch'), true],
  [{ message: 'fetch failed' }, true],
  [{ code: 'PGRST301', message: 'JWT expired' }, true],          // Review Focus 1
  [{ code: 'P0001', message: 'GC-VIS-002: falta oficina' }, false],
  [{ code: '23505', message: 'duplicate key' }, false],
] as const) test(`esErrorTransitorio(${JSON.stringify(err)})`, () => assert.equal(esErrorTransitorio(err), esperado))

// cola.test.ts
test('error transitorio no consume intentos', async () => {
  const items = encolar([], { tipo: 'visita', payload: {}, clienteKey: 'k1', id: 'i1' })
  const r = await procesarCola(items, async () => { throw { message: 'Network request failed' } }, 1000)
  assert.deepEqual([r[0].estado, r[0].intentos, r[0].ultimoError, r[0].proximoIntentoEn],
    ['pendiente', 0, 'GC-NET-001: sin conexión', 1000 + ESPERA_SIN_RED_MS])
})
test('error del servidor sí consume intentos', async () => { /* throw { code: 'P0001', … } → estado 'error', intentos 1 */ })
test('reactivar deja listo un ítem agotado', () => { /* intentos 5, estado 'error' → 'pendiente', intentos 0, proximoIntentoEn 0, ultimoError undefined */ })
test('reactivar un alta reactiva su check-in y su cierre', () => { /* visita u1 + visita_checkin/visita_completar con visitaClienteKey 'u1', los tres agotados → los tres 'pendiente' */ })

// fetchLimite.test.ts
test('aborta una petición colgada con error transitorio', async () => {
  const colgado: typeof fetch = (_u, init) => new Promise((_, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))
  await assert.rejects(fetchConLimite(10, colgado)('https://x'), (e) => esErrorTransitorio(e))
})
test('sinEnviar cuenta pendientes y errores, no enviados', () => { /* 1 pendiente + 1 error agotado + 1 enviado → 2 */ })
test('mismo clienteKey no duplica la visita', () => { /* encolar dos veces 'visita:u1' → length 1 */ }) // Review Focus 2

// colaStore.test.ts
test('reactivarItem deja el ítem listo para el próximo envío', async () => { /* con persistenciaMemoria: ítem agotado → reactivarItem → reintentables(leerCola(), ahora) lo incluye */ })
```

- [ ] **Step 2: Verlas fallar**
  Run: `pnpm --filter @gc/mobile test`
  Expected: FAIL, porque `esErrorTransitorio`, `marcarSinRed`, `reactivar` y `sinEnviar` no existen.
- [ ] **Step 3: Implementar.**
  - **`esErrorTransitorio`:** devuelve `true` en dos casos.
    1. `code === 'PGRST301'`, o el mensaje coincide con `/jwt expired/i`.
    2. El error no trae un `code` no vacío y el mensaje coincide con `/network request failed|failed to fetch|fetch failed|networkerror|timed? ?out|aborted/i`.
  - **`procesarCola`:** en el `catch`, si es transitorio usa `marcarSinRed`; si no, `marcarError` como hoy.
  - **`reactivarItem`:** publica `reactivar(activo.items, id)`. Exige `clave === activo.clave`, igual que `encolarMutacion`.
  - **`fetchConLimite`:** combina un `AbortController` propio con el `signal` del llamador. El cliente de `supabase.ts` se crea con `global: { fetch: fetchConLimite(15_000) }`.
- [ ] **Step 4: Verlas pasar**
  Run: `pnpm --filter @gc/mobile test`
  Expected: PASS, todas las suites.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/errorRed.ts apps/mobile/src/lib/cola.ts apps/mobile/src/lib/colaStore.ts apps/mobile/tests
git commit -m "fix(mobile): keep queued items alive while offline"
```

### Task 3: Caché de campo en SQLite, particionada por sesión

**Files:**
- Create: `apps/mobile/src/lib/cacheCampo.ts`, `apps/mobile/src/lib/abrirCache.ts`
- Test: `apps/mobile/tests/cacheCampo.test.ts`

**Interfaces:**
- Produces (`cacheCampo.ts`):
  - `type TipoCache = 'catalogos' | 'agenda' | 'perfil'`
  - `interface Guardado<T> { datos: T; guardadoEn: string }`
  - `interface CacheCampo { leer<T>(clave: string, tipo: TipoCache): Promise<Guardado<T> | null>; guardar<T>(clave: string, tipo: TipoCache, datos: T, ahora?: Date): Promise<void>; limpiar(clave: string): Promise<void> }`
  - `cacheSqlite(db: SqliteRunner): CacheCampo`
  - `cacheMemoria(): CacheCampo`
- Produces (`abrirCache.ts`): `abrirCacheCampo(): CacheCampo`. Instancia única sobre `SQLite.openDatabaseSync('gc-cola.db')`, con el mismo runner que `abrirCola.ts`.
- Tabla: `cache_campo (clave text not null, tipo text not null, json text not null, primary key (clave, tipo))`. El `json` guarda `{ datos, guardadoEn }`.

- [ ] **Step 1: Escribir las pruebas que fallan.** Usan `node:sqlite` `DatabaseSync(':memory:')` con el runner de `tests/colaParticionSqlite.test.ts`.
  - `'guarda y lee con la fecha de guardado'`: `guardar('t1:u1','agenda',[1],new Date('2026-11-14T08:00:00Z'))` y luego `leer` → `{ datos: [1], guardadoEn: '2026-11-14T08:00:00.000Z' }`.
  - `'otra sesión no ve la caché'`: `leer('t1:u2','agenda')` → `null`.
  - `'json corrupto se trata como sin caché'`: con una fila escrita a mano con `json = '{'`, `leer` → `null`.
  - `'limpiar borra solo esa sesión'`.
- [ ] **Step 2: Verlas fallar.** Run: `pnpm --filter @gc/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implementar** `cacheSqlite`, `cacheMemoria` y `abrirCacheCampo`.
- [ ] **Step 4: Verlas pasar.** Run: `pnpm --filter @gc/mobile test && pnpm --filter @gc/mobile typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile): add per-session field cache"`

### Task 4: Cerrar sesión conserva los registros sin enviar

Bloquear el cierre de sesión dejaría atrapado al usuario si un ítem quedó agotado. La cola ya está particionada por empresa y usuario, así que conservarla en el teléfono no la expone a otra sesión. Al volver a entrar con el mismo usuario se envía.

**Files:**
- Modify: `apps/mobile/src/lib/logoutCleanup.ts`, `apps/mobile/src/lib/logoutCleanupNativo.ts`
- Modify: `apps/mobile/src/App.tsx` (`handleLogout`, cerca de la línea 327)
- Test: `apps/mobile/tests/logoutCleanup.test.ts`

**Interfaces:**
- Consumes: `sinEnviar` (Task 2), `abrirCacheCampo` (Task 3).
- Produces: `logoutCleanup(opts: { userId; tenantId; pendientes: number; deleteSession; clearCola; clearCache: (clave: string) => Promise<void>; invalidateFcm }): Promise<{ colaConservada: boolean }>`. Con `pendientes > 0` no llama a `clearCola`; lo demás se hace igual.

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - `'con pendientes conserva la cola y cierra sesión'`: con `pendientes: 2` → `clearCola` no se llama, `deleteSession` y `clearCache('t1:u1')` sí, y devuelve `{ colaConservada: true }`.
  - `'sin pendientes limpia cola y caché de la sesión'`: `clearCola` y `clearCache` reciben `'t1:u1'` y devuelve `{ colaConservada: false }`.
- [ ] **Step 2: Verlas fallar.** Run: `pnpm --filter @gc/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - `logoutCleanupNativo` recibe `pendientes` y `clearCache` y los pasa.
  - `handleLogout` calcula `n = sinEnviar(leerCola())`. Si `n > 0`, primero pide confirmación con `Alert`: «Tienes {n} registros sin enviar. Se guardan en este teléfono y se envían cuando vuelvas a entrar con tu usuario.», con los botones [Cancelar] y [Salir].
  - Pasa `clearCache: (clave) => abrirCacheCampo().limpiar(clave)`.
- [ ] **Step 4: Verlas pasar.** Run: `pnpm --filter @gc/mobile test && pnpm --filter @gc/mobile typecheck`. Expected: PASS. La prueba existente `'logout elimina del disco solo la fila de la sesión activa'` sigue pasando sin cambios (prueba la partición, no `logoutCleanup`).
- [ ] **Step 5: Commit** — `git commit -m "fix(mobile): keep unsent records on logout"`

### Task 5: Respaldo ante falta de red: perfil y catálogos sin señal

La app arranca sin señal con los claims del JWT guardado (`resolverClaims` los decodifica en el teléfono). Pero `cargarPerfil` hace tres lecturas en línea y hoy ignora sus errores: sin señal quedan `modulos: []` (desaparece Depósitos) y la marca por defecto.

**Files:**
- Create: `apps/mobile/src/lib/respaldo.ts`
- Modify: `apps/mobile/src/lib/catalogosCampo.ts`, `apps/mobile/src/lib/catalogosTipos.ts`, `apps/mobile/src/lib/visita.ts`
- Modify: `apps/mobile/src/lib/supabase.ts` (`cargarPerfil`), `apps/mobile/src/App.tsx` (donde llama a `cargarPerfil`, cerca de la línea 135)
- Test: `apps/mobile/tests/respaldo.test.ts`, `apps/mobile/tests/visita.test.ts`

**Interfaces:**
- Consumes: `esErrorTransitorio` (Task 2), `CacheCampo` (Task 3).
- Produces:
  - `conRespaldo<T>(opts: { cargar: () => Promise<T>; leer: () => Promise<Guardado<T> | null>; guardar: (datos: T) => Promise<void> }): Promise<{ datos: T; origen: 'servidor' | 'cache'; guardadoEn?: string }>`
  - `cargarCatalogosCampo(opts: { clave: string; cache: CacheCampo }): Promise<CatalogosCampo & { origen: 'servidor' | 'cache'; guardadoEn?: string }>`
  - `cargarPerfil(session, claims, cache: CacheCampo): Promise<Perfil>`. Lanza el primer `res.error` y se envuelve en `conRespaldo` con el tipo `'perfil'` y la clave `claveParticionCola(claims.tenantId, session.user.id)`.
  - `GeoDefaults` queda como `{ horaDefaultId: number | null }`.
  - `BorradorVisita` pierde `zonaId`, `departamentoId` y `municipioId`.
  - `LIMITE_PERSONAS_CAMPO = 2000` (exportado desde `catalogosCampo.ts`).

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - **`respaldo.test.ts`:**
    - `'servidor ok guarda y devuelve origen servidor'`.
    - `'error de red usa la caché con su fecha'`.
    - `'error de red sin caché lanza GC-NET-002'`: mensaje `GC-NET-002: sin conexión y sin datos guardados`.
    - `'error del servidor se propaga y no lee la caché'`: con `{ code: '42501' }` se propaga ese mismo objeto y `leer` no se llama.
    - `'perfil guardado conserva módulos sin señal'`: caché con `{ modulos: ['depositos'] }` y cargador que lanza error de red → `datos.modulos` incluye `'depositos'`.
  - **`visita.test.ts`:**
    - Reemplazar `'GC-VIS-002 si faltan zona o geografía'` por `'oficina y geografía las resuelve el servidor'`: un borrador sin esos campos → `validarVisitaNueva` devuelve `null`. Cambia el comportamiento según el spec E0.
    - Agregar `'el límite de clientes en campo cubre carteras grandes'`: `assert.ok(LIMITE_PERSONAS_CAMPO >= 1000)` (Review Focus 3).
- [ ] **Step 2: Verlas fallar.** Run: `pnpm --filter @gc/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - `cargarCatalogosCampo` deja de consultar `departamento`/`municipio` con `limit(1)` y de calcular `zonaId`. Lanza el primer `res.error` que encuentre, en lugar de devolverlo como `aviso`, y se envuelve en `conRespaldo` con el tipo `'catalogos'`.
  - Personas: `.limit(LIMITE_PERSONAS_CAMPO)`. La caché guarda lo que devuelve el cargador; E5 agregará la ubicación del cliente a ese `select` sin tocar la caché.
  - Quitar de `validarVisitaNueva` la regla `GC-VIS-002`.
  - `App.tsx` pasa `abrirCacheCampo()` a `cargarPerfil`. Si el error no es transitorio, se comporta como hoy (perfil `null`).
- [ ] **Step 4: Verlas pasar.** Run: `pnpm --filter @gc/mobile test && pnpm --filter @gc/mobile typecheck`. Expected: PASS. Typecheck debe marcar los usos viejos de `geo.zonaId`, que se corrigen en la Task 8.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile): load field catalogs offline"`

### Task 6: Agenda local = servidor o caché + cola pendiente

**Files:**
- Create: `apps/mobile/src/lib/agendaLocal.ts`
- Modify: `apps/mobile/src/lib/tipos.ts` (`Visita`)
- Test: `apps/mobile/tests/agendaLocal.test.ts`

**Interfaces:**
- Consumes: `ItemCola` (`cola.ts`).
- Produces:
  - `Visita` cambia a `id: number | null`, agrega `cliente_key: string` y `pendiente?: boolean`.
  - `mapFilaVisita(row: Record<string, unknown>): Visita`. Se mueve desde `AgendaScreen.mapFila` y agrega `cliente_key`.
  - `rangoAgenda(desde: string, dias: number): { desde: string; hasta: string }`.
  - `descargarAgenda(cliente: SupabaseClient, desde: string, dias?: number): Promise<Visita[]>`. Por defecto `dias = 7`. Consulta `visita` entre `desde` y `hasta`, sin filtrar por usuario. La RLS da el mismo alcance que `visitas_del_dia`: lo propio, más el equipo para un supervisor. Usa las mismas columnas que hoy el fallback de `AgendaScreen`, más `cliente_key`. Lanza `res.error`.
  - `agendaConCola(base: Visita[], cola: ItemCola[], fecha: string): Visita[]`. Reconcilia por `cliente_key` y usa **todos** los estados de la cola, porque los ítems `enviado` quedan en la cola y la base puede ser más vieja que el envío:
    - Ítem `visita`: si la base no trae su `cliente_key`, se agrega.
    - Ítem `visita_completar`: si la base la trae como `programada`, se muestra `completada`.
    - Ítem `visita_checkin`: si la base no trae coordenadas, se ponen las del payload.
    - En los tres casos, `pendiente = (estado del ítem !== 'enviado')`.
    - Si la base ya refleja el efecto, manda la base.
- **Contrato de payload** (también lo usan las Tasks 7 y 8):
  - Ítem `visita`: payload `{ clienteKey: uuid, personaNombre, personaId?, actividadId, subActividadId, actividadHoraId, fecha, horaInicio, direccion?, comentario? }`; `clienteKey` del ítem: `visita:<uuid>`.
  - Ítems `visita_checkin` y `visita_completar`: payload `{ visitaId?: number, visitaClienteKey: string, latitud, longitud }`; `clienteKey` del ítem: `visita_checkin:<visitaClienteKey>` o `visita_completar:<visitaClienteKey>`.

- [ ] **Step 1: Escribir las pruebas que fallan.** Todas con `fecha = '2026-11-14'`.
  - `'visita creada sin señal aparece pendiente y programada'`: con `base = []` y un ítem `visita` pendiente → un elemento con `{ id: null, cliente_key: 'u1', pendiente: true, estado: 'programada' }`.
  - `'si el servidor ya la trae no se duplica'`: `base` con `cliente_key 'u1'` más el mismo ítem → `length 1`, `pendiente` falsy.
  - `'cierre pendiente la muestra completada'`: ítem `visita_completar` con `visitaClienteKey 'u1'` → `estado 'completada'`, `pendiente true`.
  - `'check-in pendiente pone las coordenadas del payload'`.
  - `'visita enviada que la base aún no trae sigue visible'`: ítem `visita` en estado `enviado` y `base = []` → un elemento con `pendiente` falsy.
  - `'cierre enviado con base vieja se ve completada'`: base `programada` más `visita_completar` `enviado` → `completada`.
  - `'la base que ya refleja el cierre manda'`: base `aprobada` más `visita_completar` → `aprobada`.
  - `'ignora ítems de otra fecha'`.
  - `'ordena por hora de inicio'`.
  - `rangoAgenda('2026-11-30', 7)` → `{ desde: '2026-11-30', hasta: '2026-12-06' }`.
- [ ] **Step 2: Verlas fallar.** Run: `pnpm --filter @gc/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implementar `agendaLocal.ts`.**
- [ ] **Step 4: Verlas pasar.** Run: `pnpm --filter @gc/mobile test`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile): merge cached agenda with queue"`

### Task 7: El sincronizador crea con clave y resuelve visitas locales

**Files:**
- Modify: `apps/mobile/src/lib/sync.ts`
- Test: `apps/mobile/tests/sync.test.ts` (nuevo)

**Interfaces:**
- Consumes: el contrato de payload de la Task 6 y `visita_crear` con `p_cliente_key` (Task 1).
- Produces: `resolverVisitaId(cliente: SupabaseClient, p: Record<string, unknown>): Promise<number>`.
  - Si `p.visitaId` es número, lo devuelve.
  - Si no, busca `visita.id` por `cliente_key = p.visitaClienteKey`.
  - Si no la encuentra, lanza `GC-SYNC-001: la visita aún no llega al servidor`.

- [ ] **Step 1: Escribir las pruebas que fallan.** Usan un cliente falso que registra las llamadas a `rpc(nombre, args)` y a `from('visita').select('id').eq('cliente_key', k).maybeSingle()`.
  - `'alta envía p_cliente_key y oficina/geografía nulas'`: args de `visita_crear` incluyen `p_cliente_key: 'u1'`, `p_zona_id: null`, `p_departamento_id: null` y `p_municipio_id: null`.
  - `'check-in de visita local resuelve el id por clave'`: el falso devuelve `{ data: { id: 77 } }` → `visita_checkin` se llama con `p_visita_id: 77`.
  - `'visita local aún no creada lanza GC-SYNC-001'`.
  - `'ítems de la versión anterior siguen sincronizando'`: payload `{ visitaId: 104, latitud, longitud }`, sin clave → `p_visita_id: 104`, sin consulta a `visita` (Review Focus 4).
- [ ] **Step 2: Verlas fallar.** Run: `pnpm --filter @gc/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Las ramas `visita_checkin` y `visita_completar` usan `resolverVisitaId`. La rama `visita` manda `p_cliente_key: p.clienteKey` y las tres geografías en `null`.
- [ ] **Step 4: Verlas pasar.** Run: `pnpm --filter @gc/mobile test`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile): sync offline-created visits"`

### Task 8: Pantallas móviles usan cola y caché

**Files:**
- Modify: `apps/mobile/src/screens/NuevaVisitaModal.tsx`, `apps/mobile/src/screens/AgendaScreen.tsx`, `apps/mobile/src/screens/SyncScreen.tsx`
- Modify: `apps/mobile/src/lib/supabase.ts` (borrar `persistirVisitaCampo`)

**Interfaces:**
- Consumes: Tasks 2 a 7 (`encolarYSync`, `reactivarItem`, `abrirCacheCampo`, `cargarCatalogosCampo`, `conRespaldo`, `descargarAgenda`, `agendaConCola`, `useCola().items`).

- [ ] **Step 1: `NuevaVisitaModal`.**
  - Crear la clave con `Crypto.randomUUID()` en el inicializador de `useState` al abrir el modal (Review Focus 2), no al guardar. Así un doble toque reutiliza la misma clave y `encolar` lo deduplica.
  - Guardar con `encolarYSync({ tipo: 'visita', payload, clienteKey: \`visita:${uuid}\` }, ejecutarMutacion(supabase), clave)`.
  - Mostrar «Catálogos guardados el {fecha}» si `origen === 'cache'`.
  - Quitar el texto «se usa la zona y geografía del tenant».
- [ ] **Step 2: `AgendaScreen`.**
  - `cargar()` primero pinta la caché `'agenda'` si existe (sin spinner de pantalla completa). Después refresca con `conRespaldo` y `descargarAgenda(supabase, hoy)`.
  - Recargar cuando cambie `useCola().resumen.enviados`, para que lo enviado en segundo plano (`App.tsx` sincroniza cada 30 s) se refleje desde el servidor.
  - Lo que se muestra es `agendaConCola(base.filter(v => v.fecha_visita === hoy), useCola().items, hoy)`.
  - Con `origen === 'cache'`, un aviso: «Sin conexión · agenda guardada a las {hora}».
  - Check-in y cierre usan el contrato de payload de la Task 6.
  - Quitar el estado `checkins` en memoria: el check-in hecho se deriva de `latitud != null`.
  - La `key` de la `FlatList` es `cliente_key`.
  - Un error transitorio ya no vacía la lista.
- [ ] **Step 3: `SyncScreen`.** Para ítems con `estado === 'error' && intentos >= maxIntentos`, mostrar el botón «Reintentar», que llama a `reactivarItem(item.id, clave)`.
- [ ] **Step 4: Borrar `persistirVisitaCampo`.** Confirmar antes que no tiene otros usos: `rg persistirVisitaCampo apps/mobile`.
- [ ] **Step 5: Verificar**
  Run: `pnpm --filter @gc/mobile typecheck && pnpm --filter @gc/mobile lint && pnpm --filter @gc/mobile test`
  Expected: PASS, sin errores de tipo.
- [ ] **Step 6: Commit** — `git commit -m "feat(mobile): plan and close visits offline"`

### Task 9: La web deja de mandar oficina y geografía arbitrarias

**Files:**
- Modify: `apps/web/src/lib/persistir.ts` (`persistirVisita`), `apps/web/src/lib/persistirHelpers.ts`, `apps/web/src/lib/cargarDominio.ts`, `apps/web/src/lib/catalogos.ts`, `apps/web/src/app/EmpresaApp.tsx`
- Test: `apps/web/tests/persistir.test.ts`

**Interfaces:**
- Consumes: `visita_crear` (Task 1).
- Produces:
  - `argsVisitaCrear(evento: CalendarEvent, horaDefaultId: number | null, clienteKey: string): Record<string, unknown>` en `persistirHelpers.ts`.
  - El `GeoDefaults` de la web queda como `{ horaDefaultId: number | null }`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `persistir.test.ts`.
  - `'argsVisitaCrear manda geografía nula y la clave'`: `p_zona_id`, `p_departamento_id` y `p_municipio_id` en `null`, y `p_cliente_key: 'k1'`.
  - `'usa el bloque de horas por defecto'`.
  - `'persona numérica se convierte y la demo no'`: `'12'` → `12`; `'vis-x'` → `null`.
  - `'GC-VIS-001 sin subactividad'` y `'GC-VIS-003 sin horas'`: lanzan error.
- [ ] **Step 2: Verlas fallar.** Run: `pnpm --filter @gc/web test`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - `persistirVisita` llama a `supabase.rpc('visita_crear', argsVisitaCrear(evento, geo.horaDefaultId, crypto.randomUUID()))` en lugar del `insert` directo, y devuelve `vis-${data.id}`.
  - `cargarDominio` deja de pedir `departamento`/`municipio` con `limit(1)`.
  - Ajustar `GEO_VACIO` en `EmpresaApp.tsx`.
- [ ] **Step 4: Verificar**
  Run: `pnpm --filter @gc/web test && pnpm --filter @gc/web typecheck && pnpm --filter @gc/web test:e2e`
  Expected: PASS. Si `flujos-f1.spec.ts` falla al crear una visita, actualizar su fixture de `rest/v1/visita` a `rest/v1/rpc/visita_crear`.
- [ ] **Step 5: Commit** — `git commit -m "fix(web): let server resolve visit office and geo"`

### Task 10: Desplegar en orden: base de datos → web → APK

El orden importa. La web y la app nuevas mandan `p_cliente_key`, y la Task 11 (Step 5) necesita las columnas nuevas de `zona`: salir antes que la migración las rompe.

`pages-prod.yml` publica la web **sola** después de CI verde en `main`; `supabase-prod.yml` es manual. Si la migración llegara a producción después de la web nueva, esa web llamaría a `visita_crear` con `p_cliente_key` contra la función vieja de 12 argumentos y fallaría el alta de visitas en la web de **todas** las empresas. Por eso la migración tiene que estar en producción **antes** de que se publique la web nueva. Es compatible hacia atrás: la web vieja inserta directo y las llamadas por nombre de la app vieja (12 argumentos) siguen resolviendo.

**Restricción:** `supabase-prod.yml` no se puede correr con el SHA del PR antes del merge. Su paso «Go-live preflight» (`scripts/ops/golive-preflight.ts`, checks `ci` y `pgtap`, también con `golive: false`) exige una corrida de CI `push` en `main`, exitosa y con pgTAP, para ese mismo SHA. Además, el Environment `production` tiene branch policy `main` (`docs/runbooks/plan-pase-produccion.md` §3.4). No se desactiva ese control (`AGENTS.md`).

- [ ] **Step 1: PR y CI.** Push de `habitat/e0-preparacion` y PR en GitHub (en esta PC no hay `gh`). Expected: CI `validate` en verde: lint, typecheck, unitarias, e2e con fixtures y pgTAP.
- [ ] **Step 2: Rama al día y staging.**
  - Traer `main` a la rama (merge o rebase) y esperar CI en verde sobre ese HEAD. `supabase-prod.yml` también despliega las Edge Functions del SHA: con la rama atrasada se revertirían funciones que ya están en producción.
  - Si hay staging, seguir `docs/runbooks/migrations.md`: `supabase-staging.yml` (`workflow_dispatch` desde la rama), e2e de staging y revisar errores `GC-*`. Si el runbook exige staging y no lo hay, decidirlo con Josue.
  - Antes del Step 3, correr los chequeos de producción de la Task 11, Step 1b.
- [ ] **Step 3: Migración en producción antes de publicar la web nueva — decisión pendiente con Josue.** Por la restricción de arriba hay dos caminos, sin tocar workflows:
  - **(a) Dos PR.**
    1. Primer PR: todo menos el cambio web de la Task 9 (migración, app y docs). Mergearlo; Pages republica la web vieja, que es compatible.
    2. Con CI verde en `main`, correr `supabase-prod.yml` con **ese SHA de `main`** y `golive: false`.
    3. Verificar y recién entonces mergear el PR de la Task 9.
  - **(b) Un PR, reteniendo Pages.** Solo sirve si el Environment `production` exige reviewers; está documentado, pero no se pudo verificar (403).
    1. Mergear y dejar **sin aprobar** el despliegue de `pages-prod.yml`.
    2. Correr `supabase-prod.yml` con el SHA mergeado y verificar.
    3. Recién entonces aprobar Pages.
    - Si el Environment no exige reviewers, Pages publica solo y este camino no sirve.
  - Si falla el preflight, corregir la causa; no desactivar controles (`AGENTS.md`).
  - Expected, antes de publicar la web nueva: `select pg_get_function_arguments('public.visita_crear'::regproc);` incluye `p_cliente_key uuid`, y `zona` tiene `municipio_id`.
- [ ] **Step 4: Web.** Publicar la web nueva solo después del Step 3: merge del PR de la Task 9 en (a), o aprobación de Pages en (b). Expected: en la web publicada, «Nueva visita» crea una visita y queda con la oficina del usuario.
- [ ] **Step 5: APK.** Run: `pnpm --filter @gc/mobile build:apk` (perfil EAS `preview`). Expected: build `FINISHED` con enlace de instalación. Lo usa la Task 11, Step 9.

---

## Parte B — Configuración de Hábitat (operación, sin código)

Cada escritura en producción se muestra a Josue y se ejecuta solo con su visto bueno (spec §8, Fase 0). Los Steps 1 a 4 pueden hacerse antes de la Task 10; del Step 5 en adelante, después.

### Task 11: Preparar la empresa en producción

**Files:**
- Create: `docs/ops/habitat/catalogos.sql`. Idempotente (`on conflict do nothing` / `where not exists`), con los valores de spec §7 y la zona → municipio de cada oficina.
- Create: `docs/ops/habitat/verificacion.sql`. Consultas de solo lectura.

- [ ] **Step 1: Acceso (spec 0.1).** Josue reconecta el conector Supabase a la organización GestionesComerciales, o deja `SUPABASE_ACCESS_TOKEN` en el entorno.
  Run: `select version from supabase_migrations.schema_migrations order by version desc limit 5;`
  Expected: aparece `20261002120200`. Si no, aplicar primero las migraciones de `main`.
- [ ] **Step 1b: Chequeos de producción antes de desplegar (antes de la Task 10, Step 3).** Solo lectura.
  - Oficinas que `visita_crear` va a rechazar. Con E0, si la `zona_id` del usuario está inactiva o es de otra empresa, el alta falla con `GC-VIS-002: la oficina del usuario está inactiva o no pertenece a la empresa` en vez de usar otra oficina. Revisarlo en **todas** las empresas, no solo en Hábitat:
    ```sql
    select u.tenant_id, u.id, u.nombre, u.rol, u.activo, u.zona_id,
           z.tenant_id as zona_tenant, z.activo as zona_activa
      from public.usuario u
      left join public.zona z on z.id = u.zona_id
     where u.zona_id is not null
       and (z.id is null or z.tenant_id <> u.tenant_id or not z.activo)
     order by u.tenant_id, u.nombre;
    ```
    Expected: 0 filas. Si hay, mostrarlas a Josue y corregir la `zona_id` de cada usuario (con su visto bueno) antes de la migración.
  - `max_rows` de PostgREST en producción: en el dashboard (Project Settings → API → Max rows) o con la Management API (`GET /v1/projects/{ref}/postgrest`, campo `max_rows`). La app pide clientes y agenda en páginas de 500 y toma una página corta como el final. Expected: `max_rows` ≥ 500; si es menor, la app cortaría la cartera y la agenda en silencio.
- [ ] **Step 2: Respaldo (0.12).** Revisar en GitHub Actions la última corrida de `ops-backup-prod.yml` y hacer el ensayo de restauración de `docs/runbooks/backup-restore.md` sobre Supabase local. Expected: el conteo de `public.tenant` y `public.usuario` del respaldo coincide con producción.
- [ ] **Step 3: Empresa (0.2).** En el backoffice, buscar «Hábitat»/«Habitat»; si no existe, crearla con el asistente, solo con el módulo núcleo. Expected: `select id, codigo, nombre from tenant where nombre ilike '%bitat%';` devuelve exactamente una fila.
- [ ] **Step 4: Geografía (0.3).** Importar en el backoffice (Catálogos → Geografía) el CSV `departamento,municipio` de Honduras: 18 departamentos, de la lista oficial del INE. Expected: `select count(*) from departamento where nombre in ('Cortés','Atlántida','Copán','Comayagua','Francisco Morazán','Colón')` = 6.
- [ ] **Step 5: Catálogos (0.4).**
  - Escribir `docs/ops/habitat/catalogos.sql` con las 7 zonas, cada una con su `departamento_id`/`municipio_id`:
    - Santa Rosa → Copán / Santa Rosa de Copán
    - San Pedro Sula → Cortés / San Pedro Sula
    - Siguatepeque → Comayagua / Siguatepeque
    - Tegucigalpa → Francisco Morazán / Distrito Central
    - Santa Cruz → Cortés / Santa Cruz de Yojoa
    - Aguán → Colón / Tocoa
    - La Ceiba → Atlántida / La Ceiba
  - Agregar las 5 actividades, las 30 subactividades y los 8 bloques de horas, y desactivar los catálogos de relleno.
  - Mostrarlo a Josue y ejecutarlo.
  - Expected (`verificacion.sql`): 7 zonas activas con municipio; 5 actividades; 30 subactividades; 8 horas activas; 0 activos entre «Zona 1», «Visita comercial» y «30 minutos».
  - Santa Cruz y Aguán son supuestos de Claude: confirmar el municipio con Luis.
- [ ] **Step 6: Rastreo (0.5).** Cargar `config_rastreo` desde Configuración en la web: lunes a viernes 07:30–17:30, sábado 07:30–12:30, sin domingo, intervalo 20 min, precisión 100 m. Expected: 6 filas.
- [ ] **Step 7: Usuarios (0.6).**
  - Alta en el backoffice de los usuarios de spec §6, con rol, jefe y `zona_id`, en orden gerente → admin → supervisores → asesores.
  - Linton y Nelson quedan pendientes hasta que Luis diga a quién reportan.
  - Contraseñas iniciales entregadas en privado.
  - Expected (Review Focus 5): `select nombre from usuario where tenant_id = :habitat and rol in ('asesor','supervisor') and zona_id is null;` no devuelve filas.
- [ ] **Step 7b: Base de clientes (0.7), solo si Luis la comparte.**
  - Revisar que trae nombre, DNI y el usuario del oficial asignado; los exige `admin_importar_personas`.
  - Importar en la web (Personas → Importar CSV) como Ana o como superadmin.
  - Las coordenadas se ignoran hasta E5.
  - Expected: `select asesor_id, count(*) from persona where tenant_id = :habitat group by 1` cuadra con el archivo, sin filas con `asesor_id` nulo.
- [ ] **Step 8: APK (0.8).** Instalar el APK de la Task 10, Step 5, en los teléfonos de prueba.
- [ ] **Step 9: Prueba en teléfonos reales (0.9)**, en dos marcas, con un asesor de prueba de Hábitat. Expected, todo verdadero:
  - Login y permiso de ubicación «siempre».
  - Una jornada de rastreo en segundo plano con puntos en el mapa.
  - **Modo avión con la app recién abierta:** se ve la agenda y la pestaña Depósitos sigue según los módulos guardados; se programa, se hace check-in y se cierra.
  - **Sesión vencida sin señal:** con el teléfono más de una hora sin señal, la app entra en modo sin conexión con el aviso «Modo sin conexión · tus registros se enviarán cuando vuelva la señal», con el usuario y el perfil guardados (la agenda sale de la caché y lo que se registre queda en la cola). Al volver la señal, la app renueva la sesión sola (cada 30 s o al volver a primer plano) y el aviso desaparece sin pedir login; la cola se envía. Si en cambio `supabase-js` cierra la sesión, detenerse y reportarlo como hallazgo; no parcharlo a ciegas.
  - **Más de 7 días sin señal:** con la sesión vencida hace más de 7 días, la app va a Login (no entra en modo sin conexión) y la cola se conserva; al volver a entrar con el mismo usuario, se envía. Una sesión guardada corrupta también lleva a Login (`GC-AUTH-025`); un refresh rechazado por el servidor, a Login con `GC-AUTH-026`, siempre conservando la cola.
  - **Señal débil** (limitada o intermitente): ninguna pantalla queda girando más de 15 s, y la cola sigue avanzando.
  - Al reconectar, todo llega una sola vez y la oficina es la del asesor.
  - Cerrar sesión con pendientes avisa, conserva la cola y, al volver a entrar con el mismo usuario, la envía.
  - Recuperar contraseña: llega o queda anotado como riesgo.
- [ ] **Step 10: Manuales (0.10).** Escribir `docs/ambientes/manuales/{asesor,aprobador,gerente,administrador}.md` con capturas de la prueba del Step 9 y las soluciones temporales de spec §8, Fase 1.
- [ ] **Step 11: Commit** — `git add docs/ops/habitat docs/ambientes/manuales && git commit -m "docs: add Habitat setup scripts and manuals"`

**Criterio de salida de la Fase 0:** el del spec §8. Los 21 usuarios entran (19 hasta resolver cobros), una actividad de prueba llega a Luis y la prueba del Step 9 pasa sin bloqueantes.
