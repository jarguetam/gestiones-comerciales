import { strict as assert } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const migrationsDir = `${root}/supabase/migrations`

async function finalFunctionMigration(functionName) {
  const marker = `create or replace function public.${functionName}(`
  const names = (await readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const name of names.reverse()) {
    const path = `${migrationsDir}/${name}`
    const source = await readFile(path, 'utf8')
    if (source.toLowerCase().includes(marker)) {
      return { path, source }
    }
  }

  assert.fail(`no migration defines public.${functionName}`)
}

function functionDefinition(source, functionName) {
  const marker = `create or replace function public.${functionName}(`
  const start = source.toLowerCase().indexOf(marker)
  assert.notEqual(start, -1, `missing ${marker}`)
  const rest = source.slice(start)
  const end = rest.indexOf('\n$$;')
  assert.notEqual(end, -1, `unterminated public.${functionName}`)
  return rest.slice(0, end + 4)
}

test('hmac_eq usa 32 iteraciones y queda fuera de los roles API', async () => {
  const { path, source } = await finalFunctionMigration('hmac_eq')
  const helper = functionDefinition(source, 'hmac_eq')
  const loop = helper.match(/for\s+v_i\s+in\s+0\.\.31\s+loop([\s\S]*?)end loop;/i)

  assert.ok(
    basename(path) > '20260829234800_webhook_secret_vault_validate.sql',
    'Task 6 must be a new migration after Task 4',
  )
  assert.match(helper, /returns boolean/i)
  assert.match(helper, /language plpgsql/i)
  assert.match(helper, /security definer/i)
  assert.match(helper, /set search_path = ''/i)
  assert.ok(loop, 'hmac_eq must execute a 0..31 loop')
  assert.doesNotMatch(loop[1], /\breturn\b/i)
  assert.match(helper, /v_diff\s*:=\s*v_len_a\s*#\s*32/i)
  assert.match(helper, /v_diff\s*:=\s*v_diff\s*\|\s*\(v_len_b\s*#\s*32\)/i)
  assert.match(source, /best-effort/i)
  assert.match(source, /no ofrece una garantía criptográfica/i)
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    assert.match(
      source,
      new RegExp(
        `revoke all on function public\\.hmac_eq\\(bytea, bytea\\) from ${role};`,
        'i',
      ),
    )
  }
  assert.doesNotMatch(
    source,
    /grant execute on function public\.hmac_eq\(bytea,\s*bytea\) to (?:anon|authenticated|service_role)/i,
  )
})

test('la versión final de integracion_recibir compara bytea con hmac_eq', async () => {
  const { source } = await finalFunctionMigration('integracion_recibir')
  const integration = functionDefinition(source, 'integracion_recibir')

  assert.match(integration, /v_esperada\s+bytea/i)
  assert.match(integration, /v_firma\s+bytea/i)
  assert.match(integration, /v_firma_hex\s*:=\s*lower\(/i)
  assert.match(integration, /decode\(v_firma_hex,\s*'hex'\)/i)
  assert.match(integration, /v_esperada\s*:=\s*extensions\.hmac\(/i)
  assert.match(
    integration,
    /v_firma_ok\s*:=\s*public\.hmac_eq\(v_firma,\s*v_esperada\)/i,
  )
  assert.doesNotMatch(
    integration,
    /v_firma\s*=\s*v_esperada|v_esperada\s*=\s*v_firma/i,
  )
  assert.doesNotMatch(
    integration,
    /configuracion\s*->>?\s*'webhook_secret'/i,
  )
})
