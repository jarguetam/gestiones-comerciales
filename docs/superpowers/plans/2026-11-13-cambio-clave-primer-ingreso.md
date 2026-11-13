# Cambio obligatorio de contraseña en el primer ingreso — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todo usuario creado con contraseña temporal tenga que cambiarla al entrar por primera vez, en la web y en la app.

**Architecture:** `invitar-usuario` pone `app_metadata.debe_cambiar_clave = true`. Un trigger `BEFORE UPDATE OF encrypted_password` en `auth.users` la quita cuando la contraseña cambia, por cualquier vía. La web (`RequireAuth`) y la app (`App.tsx`) leen la marca de la sesión y, mientras exista, solo muestran la pantalla «Cambia tu contraseña».

**Tech Stack:** Postgres 17 + pgTAP (Supabase CLI 2.119.0), Edge Function Deno, React 19 + Vite (web), Expo React Native (app), pruebas `node --test` sobre módulos TS puros.

**Spec:** `docs/superpowers/specs/2026-11-13-cambio-clave-primer-ingreso-design.md`

## Global Constraints

- Rama `habitat/cambio-clave-obligatorio`, worktree `C:\Users\josue.argueta\source\repos\gestiones-comerciales-habitat`.
- Herramientas (Git Bash): `export PATH="/c/Users/JOSUE~1.ARG/AppData/Local/Temp/claude/0769aaef1387406a/b92349d2-e754-4921-b0ea-c3865c1bdc70/scratchpad/bin:$PATH"` deja `pnpm` (9.15.9) y `supabase` (2.119.0). Docker Desktop debe estar arriba para Supabase local.
- La marca es exactamente la clave `debe_cambiar_clave` con valor booleano `true` en `app_metadata` (`auth.users.raw_app_meta_data`). Cualquier otro valor (`"true"`, `1`, ausente) cuenta como «sin marca».
- Nunca borrar ni pisar otras claves de `app_metadata` (`tenant_id`, `rol`, `plataforma`, `superadmin`, `activo`).
- Contraseña nueva: mínimo 8 caracteres (largo del texto tal cual, sin recortar), igual a la confirmación, distinta de la actual (GoTrue lo rechaza con `same_password`).
- Códigos y textos de error, exactos:
  - `GC-AUTH-034: la contraseña debe tener al menos 8 caracteres`
  - `GC-AUTH-035: las contraseñas no coinciden`
  - `GC-AUTH-036: la contraseña nueva debe ser distinta de la temporal`
  - `GC-AUTH-037: sin conexión; no se pudo cambiar la contraseña`
  - `GC-AUTH-038: no se pudo cambiar la contraseña`
- Textos de la pantalla, exactos, iguales en web y app:
  - título «Cambia tu contraseña»
  - texto «Entraste con una contraseña temporal. Elige una nueva para continuar.»
  - campos «Contraseña nueva» y «Confirmar contraseña»
  - botones «Guardar contraseña» y «Salir»
  - mientras comprueba: «Comprobando tu sesión…»
  - app sin señal: «Necesitas señal para cambiar tu contraseña. Conéctate e inténtalo de nuevo.»
- La pantalla solo deja cambiar la contraseña o salir. Nunca queda girando sin salida: todo spinner tiene «Salir» visible.
- Usuarios sin la marca no ven nada nuevo.

## Review Focus

1. **La sesión guardada trae la marca vieja** (recargar la web o reabrir la app después de cambiar la clave en otro lado). supabase-js no relee el usuario al cargar, así que la pantalla, al abrirse, refresca la sesión una vez. Si la marca ya no está, deja pasar. Lo prueba `decidirCambioClave` (Tasks 3 y 4).
2. **El cambio funciona pero el refresco falla por red.** No se vuelve a pedir la contraseña: se muestra GC-AUTH-037 y «Reintentar» solo vuelve a refrescar. Si se pidiera de nuevo, el usuario recibiría `same_password`.
3. **GoTrue vuelve a escribir `app_metadata` después del `UPDATE` y la marca reaparece.** Se comprueba contra GoTrue real en la Task 5; si pasa, se detiene y se reporta.
4. **Clave igual a la temporal o rechazada por la política de GoTrue** (`same_password`, `weak_password`). Se traducen a GC-AUTH-036 y GC-AUTH-034 (`mensajeErrorCambioClave`, Tasks 3 y 4).
5. **Usuarios existentes de otras empresas sin la marca, o con `"true"` en texto.** No ven la pantalla (`debeCambiarClave`, Tasks 3 y 4).

---

### Task 1: Migración — el trigger borra la marca al cambiar la contraseña

**Files:**
- Create: `supabase/migrations/20261115120000_cambio_clave_obligatorio.sql`
- Create: `supabase/tests/cambio_clave_obligatorio.sql`
- Modify: `README.md` (fila «Fase actual»: «47 migraciones» → «48 migraciones»)

**Interfaces:**
- Produces: función `public.borrar_marca_cambio_clave()` (`returns trigger`, plpgsql, **no** SECURITY DEFINER, `set search_path = ''`) y trigger `trg_borrar_marca_cambio_clave` `before update of encrypted_password on auth.users for each row when (old.encrypted_password is distinct from new.encrypted_password)`. Le quita a `new.raw_app_meta_data` solo la clave `debe_cambiar_clave` (`coalesce(..., '{}'::jsonb) - 'debe_cambiar_clave'`). `revoke all on function ... from public, anon, authenticated`.

- [ ] **Step 1: Escribir la prueba pgTAP** `supabase/tests/cambio_clave_obligatorio.sql`.
  - Formato del repo: `begin; select plan(5); … select * from finish(); rollback;`. Crear su propio usuario en `auth.users`: `raw_app_meta_data = '{"tenant_id":"…","rol":"asesor","debe_cambiar_clave":true}'`, `encrypted_password = crypt('temporal-1', gen_salt('bf'))`.
  - Casos:
    1. `update auth.users set encrypted_password = crypt('nueva-123', gen_salt('bf'))` → `raw_app_meta_data ? 'debe_cambiar_clave'` es `false`.
    2. El mismo `UPDATE` conserva `tenant_id` y `rol`.
    3. Con la marca puesta de nuevo, un `update` de `raw_user_meta_data` o `last_sign_in_at` la conserva.
    4. Volver a escribir el mismo `encrypted_password` (sin cambio real) la conserva.
    5. Un `update public.usuario set rol = …` (dispara `usuario_claims_refresh`) la conserva. Usar un usuario de `000_setup_tests.sql` al que la prueba le pone la marca.
- [ ] **Step 2: Ver que falla.** `bash scripts/ci/pgtap.sh` (con el PATH de Global Constraints). Expected: FAIL en los casos 1 y 2.
- [ ] **Step 3: Escribir la migración** con la función y el trigger de Interfaces. Agregar un comentario arriba: qué hace, que la pone `invitar-usuario` y que la lee la web/app.
- [ ] **Step 4: Ver que pasa.** `bash scripts/ci/pgtap.sh`. Expected: blank y replay en verde, todas las pruebas (la suite anterior más estas 5).
- [ ] **Step 5: README 48 migraciones.** Correr `pnpm test:contracts` en la raíz. Expected: verde. Los contratos `tests/gate5-docs.test.ts` y `tests/gate6-docs.test.ts` cuentan migraciones contra el README.
- [ ] **Step 6: Commit** — `feat(db): clear the forced password change flag when the password changes`.

### Task 2: `invitar-usuario` marca al usuario nuevo

**Files:**
- Modify: `supabase/functions/invitar-usuario/invitar.ts` (tipo `InviteDeps.createUser` y la llamada en `invitarUsuario`)
- Modify: `supabase/functions/invitar-usuario/index.ts` (`admin.auth.admin.createUser`)
- Test: `supabase/functions/invitar-usuario/invitar_test.ts`

**Interfaces:**
- Produces: `InviteDeps.createUser(input: { email: string; password: string; metadata: Record<string, string>; appMetadata: Record<string, unknown> })`. `invitarUsuario` siempre manda `appMetadata: { debe_cambiar_clave: true }`, con contraseña dada o generada. `index.ts` la pasa como `app_metadata`.

- [ ] **Step 1: Prueba** `Deno.test("marca debe_cambiar_clave al crear el usuario", …)`: captura el input de `createUser` y verifica `assertEquals(createInput.appMetadata, { debe_cambiar_clave: true })`, en un caso con `password` de 8+ caracteres y otro sin `password`. Ajustar los mocks existentes que tipan `createUser`.
- [ ] **Step 2: Ver que falla.** `npx -y deno test supabase/functions/invitar-usuario --allow-env --allow-read`. Si `deno` no corre en esta PC, anotarlo en el reporte: CI lo corre (`ci.yml`, paso `deno test`).
- [ ] **Step 3: Implementar** según Interfaces.
- [ ] **Step 4: Ver que pasa** (mismo comando). Expected: todas las pruebas de `invitar_test.ts` en verde.
- [ ] **Step 5: Commit** — `feat(auth): flag invited users to change their temporary password`.

### Task 3: Web — pantalla «Cambia tu contraseña»

**Files:**
- Create: `apps/web/src/features/auth/cambioClave.ts`
- Create: `apps/web/src/features/auth/CambioClaveObligatorio.tsx`
- Modify: `apps/web/src/app/RequireAuth.tsx`
- Modify: `apps/web/src/locales/es/errors.json` (GC-AUTH-034 a 038, textos de Global Constraints)
- Test: `apps/web/tests/cambio-clave.test.ts`

**Interfaces:**
- Produces (`cambioClave.ts`, sin dependencias de React ni de Supabase):
  - `debeCambiarClave(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): boolean`
  - `validarClaveNueva(nueva: string, confirmar: string): string | null` → GC-AUTH-034, GC-AUTH-035 o `null`
  - `mensajeErrorCambioClave(error: { code?: string; name?: string; message?: string; status?: number } | null | undefined): string`. Si `code` es `same_password` devuelve GC-AUTH-036; si es `weak_password`, GC-AUTH-034. Un error de red (`name === 'AuthRetryableFetchError'`, `status === 0` o `TypeError` de `fetch`) devuelve GC-AUTH-037. Todo lo demás, GC-AUTH-038.
  - `decidirCambioClave(user): 'liberar' | 'pedir'` (`'liberar'` cuando `debeCambiarClave(user)` es `false`)

- [ ] **Step 1: Pruebas** en `apps/web/tests/cambio-clave.test.ts` (`node:test` + `assert`, como `tests/claims.test.ts`):
  - `debeCambiarClave` es `true` solo con `{ app_metadata: { debe_cambiar_clave: true } }`. Es `false` para `null`, `{}`, sin `app_metadata`, `"true"`, `1` y `false`.
  - `validarClaveNueva('1234567', '1234567')` → GC-AUTH-034. `validarClaveNueva('12345678', '12345679')` → GC-AUTH-035. `validarClaveNueva('12345678', '12345678')` → `null`.
  - `mensajeErrorCambioClave`: `{ code: 'same_password' }` → GC-AUTH-036; `{ code: 'weak_password' }` → GC-AUTH-034; `{ name: 'AuthRetryableFetchError', status: 0 }` → GC-AUTH-037; `{ message: 'x' }` → GC-AUTH-038.
  - `decidirCambioClave` con y sin marca.
- [ ] **Step 2: Ver que falla.** `pnpm --filter @gc/web test`. Expected: FAIL (el módulo no existe).
- [ ] **Step 3: Implementar `cambioClave.ts`.** Agregar los códigos a `errors.json` y correr el test de códigos existente (`tests/gc-codes.test.ts`).
- [ ] **Step 4: `CambioClaveObligatorio.tsx`**, con los componentes y estilos de `Login.tsx`. Tiene cuatro estados:
  1. Al montar, «Comprobando tu sesión…» y una sola llamada a `supabase.auth.refreshSession()`. Si el usuario devuelto da `'liberar'`, no hace nada más: `useAuth` recibe la sesión nueva y `RequireAuth` deja pasar. Si da `'pedir'` o el refresco falla, muestra el formulario.
  2. Al guardar, `validarClaveNueva`. Si pasa, `supabase.auth.updateUser({ password })`; si falla, `mensajeErrorCambioClave`.
  3. Si `updateUser` funcionó, `refreshSession()`. Si el refresco falla, muestra GC-AUTH-037 y un botón «Reintentar» que solo vuelve a llamar a `refreshSession()`. No vuelve a pedir la contraseña.
  4. «Salir» siempre visible: `supabase.auth.signOut()`.
- [ ] **Step 5: `RequireAuth`**: con sesión y `debeCambiarClave(session.user)`, renderiza `<CambioClaveObligatorio />` en vez de `children`.
- [ ] **Step 6: Ver que pasa.** `pnpm --filter @gc/web test`, `pnpm --filter @gc/web typecheck`, `pnpm --filter @gc/web lint`. Expected: todo verde, sin errores de lint nuevos.
- [ ] **Step 7: Commit** — `feat(web): force a password change while the temporary-password flag is set`.

### Task 4: App — pantalla «Cambia tu contraseña»

**Files:**
- Create: `apps/mobile/src/lib/cambioClave.ts` (mismas cuatro funciones y firmas que la Task 3; copia, como `claims.ts` en ambas apps)
- Create: `apps/mobile/src/screens/CambioClaveScreen.tsx`
- Modify: `apps/mobile/src/lib/perfil.ts` (`Perfil.debeCambiarClave: boolean`; `perfilDesdeFuentes` lo pone en `false`)
- Modify: `apps/mobile/src/lib/supabase.ts` (`cargarPerfil`) y `apps/mobile/src/lib/sesionSinConexion.ts` (`perfilSinConexion`)
- Modify: `apps/mobile/src/App.tsx`
- Test: `apps/mobile/tests/cambio-clave.test.ts`; ajustar `tests/perfil.test.ts` y las pruebas de `perfilSinConexion` que comparan el perfil completo.

**Interfaces:**
- Consumes: las firmas de `cambioClave.ts` de la Task 3.
- Produces:
  - `Perfil.debeCambiarClave: boolean`.
  - `cargarPerfil` devuelve `{ ...perfilResuelto, debeCambiarClave: debeCambiarClave(session.user) }` y `perfilSinConexion` hace lo mismo con `g.user`. La marca sale siempre de la sesión, nunca de la copia guardada del perfil.
  - `CambioClaveScreen` con props `{ sinConexion: boolean; onListo: () => void; onSalir: () => void }`.

- [ ] **Step 1: Pruebas** en `apps/mobile/tests/cambio-clave.test.ts`:
  - Los mismos casos de la Task 3 para las cuatro funciones.
  - `perfilSinConexion` con una sesión guardada que trae `app_metadata.debe_cambiar_clave: true` da `debeCambiarClave === true`, aunque la copia del perfil en la caché diga `false`. Sin la marca da `false`.
- [ ] **Step 2: Ver que falla.** `pnpm --filter @gc/mobile test`.
- [ ] **Step 3: Implementar** `cambioClave.ts`, el campo de `Perfil` y la marca en `cargarPerfil` y `perfilSinConexion`. `LoginScreen` ya arma el perfil con `cargarPerfil`. Si `typecheck` muestra otro lugar que construye un `Perfil`, ponerle la marca desde la sesión que tenga a mano.
- [ ] **Step 4: `CambioClaveScreen.tsx`**, con los componentes de `LoginScreen`/`AjustesScreen` (`Boton`, `Card`, `useTheme`) y los cuatro estados de la Task 3 Step 4. Diferencias:
  - Con `sinConexion` muestra solo el texto «Necesitas señal…» y «Salir».
  - Cuando el refresco devuelve `'liberar'`, llama a `onListo()`.
- [ ] **Step 5: `App.tsx`**: en la rama que hoy renderiza `<Shell …>`, si `perfil.debeCambiarClave`, renderiza `<CambioClaveScreen>`.
  - `onListo` hace `setPerfil({ ...perfil, debeCambiarClave: false })`.
  - `onSalir` cierra sesión igual que «Salir» de Ajustes (`cerrarSesionYBorrar` de `lib/sesionBorrar.ts`) y luego `setSinConexion(false)` y `setPerfil(null)`.
  - El rastreo y la cola no arrancan mientras la pantalla está, porque viven en `Shell`.
- [ ] **Step 6: Ver que pasa.** `pnpm --filter @gc/mobile test`, `pnpm --filter @gc/mobile typecheck`, `pnpm --filter @gc/mobile lint`. Expected: todo verde.
- [ ] **Step 7: Commit** — `feat(mobile): force a password change while the temporary-password flag is set`.

### Task 5: Comprobación contra GoTrue local y script para Hábitat

**Files:**
- Create: `docs/ops/habitat/08-marcar-cambio-clave.sql`

- [ ] **Step 1: Comprobar contra GoTrue real** (Supabase local con la migración aplicada; `supabase status -o env` da `API_URL` y `SERVICE_ROLE_KEY` locales). Script `node` desechable fuera del repo, con `@supabase/supabase-js` del workspace. Hace, en orden:
  1. `admin.auth.admin.createUser({ email: 'clave.prueba@example.test', password: 'temporal-1', email_confirm: true, app_metadata: { debe_cambiar_clave: true } })`.
  2. `signInWithPassword`: `data.user.app_metadata.debe_cambiar_clave === true`.
  3. `updateUser({ password: 'temporal-1' })`: el error tiene `code === 'same_password'`.
  4. `updateUser({ password: 'nueva-12345' })`: sin error.
  5. `refreshSession()`: `data.user.app_metadata.debe_cambiar_clave` es `undefined` y `tenant_id`/`rol` siguen como estaban.
  6. Leer `raw_app_meta_data` por `psql`: sin la marca.
  7. Borrar el usuario.

  Si el paso 5 o el 6 fallan, detenerse y reportar (Review Focus 3).
- [ ] **Step 2: `08-marcar-cambio-clave.sql`**, mismo estilo que `07-usuarios-oficina-jefe.sql` (una transacción y validaciones que abortan).
  - Agrega `{"debe_cambiar_clave": true}` con `||` a todos los usuarios activos de Hábitat (`codigo = 'h-bitat-para-la-humanidad-honduras'`) menos `admin2@gestionescomerciales.com`.
  - Exige exactamente 19 filas: 18 nuevos más Luis.
  - Deja auditoría.
  - Probarlo dos veces en Supabase local sobre una réplica mínima, como en la Task 11 de Hábitat.
- [ ] **Step 3: Commit** — `docs: add Habitat script to require a password change`.
