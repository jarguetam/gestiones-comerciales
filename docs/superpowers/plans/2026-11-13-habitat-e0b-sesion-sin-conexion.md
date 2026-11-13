# Hábitat — E0b: modo sin conexión y caché de clientes sin documento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un asesor que abre la app sin señal, con la sesión vencida (más de 1 h sin conexión), entre igual con su usuario y su perfil guardados, trabaje sin conexión y la sesión se renueve sola al volver la señal. Además, que la caché del teléfono no guarde números de documento de clientes.

**Architecture:**
- auth-js 2.112.4 conserva la sesión guardada cuando la renovación falla por red (`isAuthRetryableFetchError`) y solo la borra si el servidor la rechaza con el token vencido (`GoTrueClient.js` ~4281-4300). Por eso «hay sesión guardada pero `INITIAL_SESSION` llega sin sesión» significa «no se pudo renovar por falta de red».
- En ese caso la app entra en **modo sin conexión**: usuario y claims de la sesión guardada (`claimsEmpresaDe` decodifica el JWT localmente), perfil desde la caché (`resolverPerfil`), y cola y cachés de esa partición.
- Mientras dure, cada 30 s y al volver la app al frente intenta `supabase.auth.refreshSession({ refresh_token })`:
  - Si renueva, auth-js emite el evento y la app vuelve al modo normal.
  - Si el servidor rechaza la renovación, la app vuelve a Login y la cola se conserva en su partición.
  - Si vuelve a fallar por red, sigue en modo sin conexión.

**Tech Stack:** React Native + Expo SDK 54, `@supabase/supabase-js`/`auth-js` 2.112.4, `expo-secure-store` (vía `sesionStorage`), `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-13-habitat-roadmap-design.md` (§8 E0 «Listo cuando»: modo avión con la app recién abierta). Decisiones de Josue del 2026-11-13: modo sin conexión según la propuesta; la caché guarda solo id, nombre, dirección (y categoría, que no es dato sensible).

## Global Constraints

- Las del plan `2026-11-13-habitat-fase0-e0.md` siguen vigentes:
  - `GC-*` y nunca tragar errores.
  - Nada se borra de la cola sin confirmación del servidor.
  - `node:test` sin RTL.
  - Sin dependencias nuevas.
  - Commits de ≤50 caracteres que terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Rama `habitat/e0-preparacion`, sin push.
- **Clave de la sesión guardada:** la de supabase-js por defecto, `sb-${new URL(url).hostname.split('.')[0]}-auth-token`. Se fija explícitamente con ese mismo valor, así no se cierra la sesión de nadie al actualizar.
- **Límite del modo sin conexión:** solo si el `access_token` guardado venció hace 7 días o menos (`MAX_DIAS_SIN_CONEXION = 7`, decisión de Claude). Pasado ese plazo, a Login.
- **El modo sin conexión no da acceso nuevo:** el JWT vencido nunca se manda al servidor. Las escrituras esperan en la cola (`GC-NET-004` es transitorio) y las lecturas usan la caché.
- **Mensajes:** errores nuevos `GC-AUTH-025: sesión guardada ilegible` (sesión guardada corrupta, se advierte y se va a Login) y `GC-AUTH-026: sesión rechazada al renovar` (el servidor rechazó el refresh, se va a Login).

## Review Focus

1. **Sesión guardada con JSON corrupto o sin `refresh_token`:** se va a Login sin colgarse, con advertencia `GC-AUTH-025`. *Prueba en Task 2.*
2. **Volver la señal con la app abierta:** el modo sin conexión termina solo, sin pedir login, y la cola se envía. *Prueba de la decisión en Task 2; flujo en Task 3.*
3. **Refresh rechazado (usuario dado de baja o token revocado):** Login, sin perder la cola de ese usuario. *Prueba en Task 2.*
4. **Cliente sin documento en caché:** la búsqueda sin señal por nombre o categoría sigue funcionando; el duplicado por documento lo detecta el servidor. *Prueba en Task 1.*
5. **Sesión vencida hace más de 7 días:** Login, no modo sin conexión. *Prueba en Task 2.*

---

### Task 1: La caché de clientes no guarda documento

**Files:**
- Modify: `apps/mobile/src/lib/catalogosCampo.ts` (columnas de personas del cargador de catálogos), `apps/mobile/src/screens/PersonaScreen.tsx` (búsqueda y aviso)
- Test: `apps/mobile/tests/catalogosCampo.test.ts` (o el archivo existente que prueba el cargador paginado)

**Interfaces:**
- Produces: `COLUMNAS_PERSONA_CACHE = 'id, nombre, direccion, categoria'`, usada por el cargador de catálogos (lo que se guarda en la caché). `cargarCartera` en línea sigue con `COLUMNAS_PERSONA`; esa lista no se cachea porque su `guardar` es no-op.

- [ ] **Step 1: Prueba que falla.** `'la caché de clientes no incluye documento'`: con un cliente falso que registra el `select` del paginado de personas, el string no contiene `documento` y sí contiene `id`, `nombre` y `direccion`.
- [ ] **Step 2: Verla fallar.** Run: `pnpm --filter @gc/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - `PersonaScreen`: sin señal (origen caché) el placeholder dice «Buscar por nombre o categoría». La verificación local de duplicado por documento (`GC-PER-030`) solo corre si la lista trae documento; si no, el servidor lo rechaza por su índice único y el rechazo se ve como `errorEnvio`/mensaje.
- [ ] **Step 4: Verificar.** Run: `pnpm --filter @gc/mobile test && pnpm --filter @gc/mobile typecheck && pnpm --filter @gc/mobile lint`. Expected: PASS.
- [ ] **Step 5: Commit** — `fix(mobile): keep client documents out of cache`

### Task 2: Lógica pura de la sesión sin conexión

**Files:**
- Create: `apps/mobile/src/lib/sesionSinConexion.ts`
- Modify: `apps/mobile/src/lib/supabase.ts` (`createClient` con `auth.storageKey: CLAVE_SESION`; exportar `CLAVE_SESION`)
- Test: `apps/mobile/tests/sesionSinConexion.test.ts`

**Interfaces:**
- Produces (todo sin importar el cliente Expo):
  - `claveSesionSupabase(url: string): string`
  - `interface SesionGuardada { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } }`
  - `leerSesionGuardada(storage: { getItem(k: string): Promise<string | null> }, clave: string, advertir?: (m: string, d: unknown) => void): Promise<SesionGuardada | null>`. JSON inválido o sin `access_token`/`refresh_token`/`user.id` → `null` + `advertir('GC-AUTH-025: sesión guardada ilegible', err)`. Sin valor → `null` sin advertir.
  - `MAX_DIAS_SIN_CONEXION = 7`
  - `puedeEntrarSinConexion(g: SesionGuardada, ahoraMs: number): boolean`. Si `expires_at` falta → `true`. Si no → `ahoraMs - expires_at*1000 <= 7 días`.
  - `perfilSinConexion(g: SesionGuardada, cache: CacheCampo, advertir?): Promise<Perfil | null>`:
    - Claims con `claimsEmpresaDe({ accessToken: g.access_token, appMetadata: g.user.app_metadata })`; sin claims → `null`.
    - Si hay claims, llama a `resolverPerfil` (de `perfilRespaldo.ts`) con `leerFuentes` que lanza `new Error(MENSAJE_SESION_SIN_RENOVAR)` (de `sesionVigente.ts`), `clave = claveParticionCola(tenantId, g.user.id)` y la caché recibida. Así usa el perfil guardado o, si no hay, el degradado.
  - `type DecisionRenovar = 'normal' | 'seguir' | 'login'` y `decidirTrasRenovar(r: { session: unknown | null; error: unknown | null }): DecisionRenovar`:
    - Hay sesión → `'normal'`.
    - Hay error transitorio (`esErrorTransitorio`, o `name === 'AuthRetryableFetchError'`) → `'seguir'`.
    - Cualquier otro error, o sin sesión y sin error → `'login'`.

- [ ] **Step 1: Pruebas que fallan.**
  - `claveSesionSupabase('https://xcoeipsnykceorcvjwve.supabase.co')` → `'sb-xcoeipsnykceorcvjwve-auth-token'`; `'http://127.0.0.1:54321'` → `'sb-127-auth-token'`.
  - `leerSesionGuardada`: JSON válido → objeto; `'{'` → `null` + advertencia `GC-AUTH-025`; sin `refresh_token` → `null` + advertencia; storage vacío → `null` sin advertencia (Review Focus 1).
  - `puedeEntrarSinConexion`: vencido hace 6 días → `true`; hace 8 días → `false` (Review Focus 5); sin `expires_at` → `true`.
  - `perfilSinConexion`: con perfil en `cacheMemoria()` → ese perfil (con sus `modulos`); sin caché → perfil degradado con el `tenantId` y el `rol` del JWT; JWT sin claims → `null`.
  - `decidirTrasRenovar`: `{ session: {...}, error: null }` → `'normal'`; `{ session: null, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } }` → `'seguir'` (Review Focus 2); `{ session: null, error: { name: 'AuthApiError', status: 400, message: 'Invalid Refresh Token' } }` → `'login'` (Review Focus 3).
- [ ] **Step 2: Verlas fallar.** Run: `pnpm --filter @gc/mobile test`. Expected: FAIL.
- [ ] **Step 3: Implementar** y fijar `auth.storageKey: CLAVE_SESION` en `supabase.ts`, con `CLAVE_SESION = claveSesionSupabase(supabaseUrl)`.
- [ ] **Step 4: Verificar.** Run: `pnpm --filter @gc/mobile test && pnpm --filter @gc/mobile typecheck && pnpm --filter @gc/mobile lint`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(mobile): offline session from stored login`

### Task 3: La app entra y sale del modo sin conexión

**Files:**
- Modify: `apps/mobile/src/App.tsx` (listener de sesión ~128-150; `Shell` ~214)

**Interfaces:**
- Consumes (Task 2): `CLAVE_SESION`, `leerSesionGuardada`, `puedeEntrarSinConexion`, `perfilSinConexion`, `decidirTrasRenovar`; `sesionStorage` y `abrirCacheCampo()`.

- [ ] **Step 1: Entrada.** En el listener de `suscribirSesion`, cuando `!estado.session` y el evento NO es `SIGNED_OUT`:
  - Leer la sesión guardada.
  - Si existe y `puedeEntrarSinConexion` → `perfilSinConexion`; si da perfil, `setPerfil(perfil)`, `setSinConexion(guardada)` y `setListo(true)`, sin pasar por el camino de «sin sesión» que limpia la cola.
  - En cualquier otro caso, el comportamiento actual.
  - `SIGNED_OUT` siempre sale del modo sin conexión.
- [ ] **Step 2: Salida.** Mientras `sinConexion` no sea `null`: cada 30 s y en `AppState 'active'`, `supabase.auth.refreshSession({ refresh_token: sinConexion.refresh_token })` → `decidirTrasRenovar`:
  - `'normal'` → `setSinConexion(null)`. El listener recibe `TOKEN_REFRESHED`/`SIGNED_IN` y recarga el perfil como hoy.
  - `'seguir'` → nada.
  - `'login'` → `console.warn('GC-AUTH-026: sesión rechazada al renovar', error)`, `setSinConexion(null)`, `setPerfil(null)`. La cola queda en su partición. No llamar a `clearCola`.
  - Sin intervalos colgando al desmontar.
- [ ] **Step 3: Aviso.** `Shell` recibe `sinConexion: boolean` y muestra arriba, con el kit UI y `useTheme()`: «Modo sin conexión · tus registros se enviarán cuando vuelva la señal». Con `accessibilityLabel`.
- [ ] **Step 4: Cerrar sesión en modo sin conexión.** `handleLogout` funciona igual. `signOut` local borra la sesión guardada y la cola se conserva si hay pendientes (Task 4 del plan anterior). Si `signOut` falla por red, se advierte y se sale igual a Login.
- [ ] **Step 5: Verificar.** Run: `pnpm --filter @gc/mobile typecheck && pnpm --filter @gc/mobile lint && pnpm --filter @gc/mobile test`. Expected: PASS. Recorrer el flujo en el código y anotarlo en el reporte:
  - App abierta en modo avión con el token vencido → modo sin conexión → agendar, check-in y cerrar quedan en cola.
  - Vuelve la señal → `refreshSession` → normal → la cola se envía.
  - Refresh rechazado → Login con la cola conservada.
- [ ] **Step 6: Commit** — `feat(mobile): enter and leave offline mode`

### Task 4: Documentación del cambio

**Files:**
- Modify: `openspec/changes/habitat-e0-oficina-sin-senal/specs/visitas/spec.md` y `tasks.md`; `docs/superpowers/plans/2026-11-13-habitat-fase0-e0.md`

- [ ] **Step 1:** Escenarios WHEN/THEN para el modo sin conexión (entrada, salida normal, refresh rechazado, más de 7 días) y para la caché sin documento. Registrar en el OpenSpec las decisiones R3/R4 (perfil degradado en vez de bloquear el login).
- [ ] **Step 2:** En el plan anterior, Task 11 Step 9 «Sesión vencida sin señal»: expected = la app entra en modo sin conexión con el aviso, y al volver la señal sale sola. Agregar el caso «más de 7 días sin señal → Login».
- [ ] **Step 3: Commit** — `docs: record offline mode and cache rules`
