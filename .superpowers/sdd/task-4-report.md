# Task 4 — secreto HMAC de webhook en Supabase Vault

## Estado

Implementado en `cursor/gate-1-security-9de6`.

- El secreto recuperable vive cifrado en Supabase Vault.
- `private.tenant_webhook_secret` solo relaciona tenant con el UUID de Vault y
  guarda `secret_last4`/`rotated_at`.
- La migración mueve secretos legados y elimina únicamente
  `configuracion.webhook_secret`.
- Backoffice consume estado canónico y solo muestra plaintext tras una
  rotación exitosa.
- `integracion_recibir` conserva firma, respuesta y comparación actuales; solo
  cambia la lectura a Vault.

## Contratos

### `public.admin_webhook_rotar_secret(p_tenant_id uuid) -> jsonb`

Conserva nombre y parámetro del RPC anterior. Solo permite un usuario de
plataforma que sea superadmin o pueda operar el tenant. Retorna:

```json
{
  "tenantId": "uuid",
  "configurado": true,
  "rotadoEn": "timestamptz",
  "last4": "abcd",
  "secret": "plaintext emitido una vez"
}
```

La rotación toma lock del tenant, actualiza el mismo secreto de Vault cuando ya
existe y registra auditoría sin plaintext.

### `public.admin_webhook_secret_estado(p_tenant_id uuid) -> jsonb`

Usa la misma autorización de plataforma y retorna `WebhookSecretStatus`:

```json
{
  "tenantId": "uuid",
  "configurado": true,
  "rotadoEn": "timestamptz o null",
  "last4": "abcd o null"
}
```

No retorna `secret` ni `vault_secret_id`. El parser de backoffice rechaza
explícitamente una respuesta de estado que contenga una key `secret`.

### `public.integracion_recibir(...) -> jsonb`

No cambian argumentos, grants ni forma de respuesta. Lee
`vault.decrypted_secrets.decrypted_secret` mediante la relación privada. La
comparación `v_firma = v_esperada` queda deliberadamente intacta para Task 6.

## API de Vault verificada

Fuentes:

- Documentación oficial: <https://supabase.com/docs/guides/database/vault>
- SQL de la extensión:
  <https://github.com/supabase/vault/blob/main/sql/supabase_vault--0.3.0.sql>
- Upgrade 0.3.1 sin cambios SQL:
  <https://github.com/supabase/vault/blob/main/sql/supabase_vault--0.3.0--0.3.1.sql>

Firmas verificadas en el SQL oficial:

```sql
vault.create_secret(
  new_secret text,
  new_name text = null,
  new_description text = '',
  new_key_id uuid = null
) returns uuid

vault.update_secret(
  secret_id uuid,
  new_secret text = null,
  new_name text = null,
  new_description text = null,
  new_key_id uuid = null
) returns void
```

La vista `vault.decrypted_secrets` expone `decrypted_secret` al SQL autorizado.
La versión 0.3.1 no define una función `delete_secret`; Task 4 no hace deletes
directos sobre las tablas internas de la extensión.

## Migración de datos

`20260829234500_webhook_secret_vault.sql` es una migración nueva; no se
modificaron migraciones históricas.

1. Habilita `supabase_vault` si falta.
2. Crea schema/tabla privada.
3. Para cada tenant con la key legado, llama `vault.create_secret`, guarda su
   UUID y metadatos privados.
4. Ejecuta `configuracion = configuracion - 'webhook_secret'`, conservando todas
   las demás keys.
5. Agrega un `CHECK` que impide reintroducir la key en la tabla pública.
6. Las rotaciones posteriores usan `vault.update_secret` y conservan el UUID.

Todo corre dentro de la transacción de la migración: una falla revierte tanto
la creación en Vault como el contract del JSON.

## Permisos

- `private` no está en los schemas expuestos por PostgREST.
- Se revoca acceso a schema/tabla privada para `PUBLIC`, `anon` y
  `authenticated`; la tabla además tiene RLS sin policies.
- Se revoca acceso directo de `anon`/`authenticated` a `vault.secrets`,
  `vault.decrypted_secrets`, `vault.create_secret` y `vault.update_secret`.
- No existe ningún `GRANT` de tabla privada para `authenticated`.
- Los RPC administrativos son `SECURITY DEFINER`, `search_path = ''`, con
  nombres de objetos calificados y autorización de plataforma antes de leer o
  escribir.
- `integracion_recibir` sigue disponible únicamente para `service_role`.

## TDD y evidencia

### RED

Commit publicado antes de ejecutar RED:

- `209957c test: define Vault webhook secret contracts`

Comando:

```bash
node --experimental-strip-types --test src/features/empresas/webhook.test.ts
```

Resultado esperado observado: exit 1,
`SyntaxError: ... does not provide an export named
'webhookSecretRotadoDeRpc'`.

El único intento de pgTAP fue:

```bash
supabase test db --file supabase/tests/p0_webhook_secret.sql
```

Resultado: exit 127, `supabase: command not found`. La VM tampoco dispone de
`docker`, por lo que no hay backend alternativo para ejecutar pgTAP. No se hizo
un segundo intento. El plan pgTAP final es coherente: 22 aserciones declaradas y
22 llamadas de aserción.

El hardening contra reintroducción se agregó primero en:

- `145e783 test: forbid webhook secret reintroduction`

No fue posible observar su RED dinámico por el mismo bloqueo de pgTAP.

### GREEN

Commits de implementación publicados antes de GREEN:

- `4351b22 fix: move webhook secrets into Supabase Vault`
- `f0285a1 fix: enforce webhook secret storage boundary`

Resultados:

```text
node --experimental-strip-types --test src/features/empresas/webhook.test.ts
5 tests, 5 pass, 0 fail

pnpm --filter @gc/backoffice test
25 tests, 25 pass, 0 fail

pnpm --filter @gc/backoffice typecheck
exit 0

pnpm --filter @gc/web typecheck
exit 0

pnpm --filter @gc/backoffice build
112 modules transformed; build exitoso
```

Validación SQL estática con `pglast 8.4`:

```text
supabase/migrations/20260829234500_webhook_secret_vault.sql: 42 statements
supabase/tests/p0_webhook_secret.sql: 37 statements
supabase/tests/006_importer_webhook.sql: 30 statements
```

Los tres archivos parsearon sin error con gramática PostgreSQL. También pasó
`git diff origin/main...HEAD --check`.

No se tocó TypeScript de Edge Functions, por lo que `deno fmt --check` no
aplica. `apps/web/src/lib/cargarDominio.ts` ya no contenía ni modelaba
`webhook_secret`; se verificó y no requirió cambio.

## Concerns

1. pgTAP queda pendiente de ejecución en CI o en un entorno con Supabase CLI y
   Docker. La validación disponible aquí cubre sintaxis SQL, planes y contratos
   cliente, pero no reemplaza una base real con Vault.
2. Task 6 debe reemplazar la comparación textual de HMAC por una comparación
   resistente a timing; Task 4 no altera esa lógica.
3. Vault 0.3.1 no ofrece API de borrado. Borrar un tenant elimina la relación
   privada por cascade, pero puede dejar el secreto cifrado huérfano en Vault.
   Resolver lifecycle/delete requiere una decisión separada y no se implementó
   con acceso directo a internals.
4. El retorno del RPC de rotación cambia de `text` a JSON, aunque conserva
   nombre y parámetro. Backoffice quedó migrado; consumidores externos deben
   leer `secret` del objeto.
