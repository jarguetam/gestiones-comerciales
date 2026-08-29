import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const migrations = {
  expand: `${root}/supabase/migrations/20260829234500_webhook_secret_vault_expand.sql`,
  backfill: `${root}/supabase/migrations/20260829234600_webhook_secret_vault_backfill.sql`,
  contract: `${root}/supabase/migrations/20260829234700_webhook_secret_vault_contract.sql`,
}

async function sql(name) {
  return readFile(migrations[name], 'utf8')
}

test('Task 4 ordena EXPAND, BACKFILL y CONTRACT en migraciones consecutivas', () => {
  assert.deepEqual(
    Object.values(migrations).map((path) => path.match(/(\d+)_webhook_secret_vault_(\w+)\.sql$/)?.slice(1)),
    [
      ['20260829234500', 'expand'],
      ['20260829234600', 'backfill'],
      ['20260829234700', 'contract'],
    ],
  )
})

test('EXPAND instala capture, RPC compatible y fallback sin lock de backfill', async () => {
  const source = await sql('expand')

  assert.match(source, /create trigger capture_tenant_webhook_secret/)
  assert.match(source, /create or replace function public\.admin_webhook_rotar_secret/)
  assert.match(source, /admin_webhook_rotar_secret\(p_tenant_id uuid\)\s+returns text/)
  assert.doesNotMatch(source, /drop function public\.admin_webhook_rotar_secret/)
  assert.match(source, /t\.configuracion ->> 'webhook_secret'/)
  assert.doesNotMatch(source, /lock table/i)
  assert.match(source, /v_es_backfill := coalesce\(/)
  assert.match(source, /if not coalesce\(v_es_superadmin, false\)/)
  assert.match(
    source,
    /revoke all on function private\.capture_tenant_webhook_secret\(\) from service_role/,
  )
})

test('BACKFILL es DML sin DDL ni lock de tabla', async () => {
  const source = await sql('backfill')

  assert.match(source, /set_config\('app\.webhook_secret_backfill', '1', true\)/)
  assert.match(source, /update public\.tenant/)
  assert.doesNotMatch(source, /alter table/i)
  assert.doesNotMatch(source, /lock table/i)
})

test('CONTRACT elimina fallback y valida el check sin scan bajo ACCESS EXCLUSIVE', async () => {
  const source = await sql('contract')

  assert.match(source, /create or replace function public\.integracion_recibir/)
  assert.doesNotMatch(source, /configuracion ->> 'webhook_secret'/)
  assert.match(source, /check \(not \(configuracion \? 'webhook_secret'\)\) not valid/)
  assert.match(source, /validate constraint tenant_configuracion_sin_webhook_secret/)
  assert.doesNotMatch(source, /migrar_webhook_secrets_legacy/)
  assert.doesNotMatch(source, /lock table/i)
})
