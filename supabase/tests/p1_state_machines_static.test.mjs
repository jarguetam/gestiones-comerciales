import { strict as assert } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const migrationsDir = resolve(root, 'supabase/migrations')
const pgtapPath = resolve(root, 'supabase/tests/p1_state_machines.sql')

async function taskMigration() {
  const matches = (await readdir(migrationsDir))
    .filter((name) => /^\d{14}_revoke_direct_updates\.sql$/.test(name))
    .sort()

  assert.equal(
    matches.length,
    1,
    'Task 7 debe crear una única migración nueva *_revoke_direct_updates.sql',
  )
  const path = resolve(migrationsDir, matches[0])
  return { path, source: await readFile(path, 'utf8') }
}

function grantedColumns(source, table) {
  const match = source.match(
    new RegExp(
      `grant\\s+update\\s*\\(([^)]*)\\)\\s+on\\s+(?:table\\s+)?public\\.${table}\\s+to\\s+authenticated`,
      'i',
    ),
  )
  assert.ok(match, `falta GRANT UPDATE por columnas para ${table}`)
  return match[1]
    .split(',')
    .map((column) => column.trim().toLowerCase())
    .filter(Boolean)
    .sort()
}

test('la migración revoca UPDATE amplio y concede solo columnas editables', async () => {
  const { path, source } = await taskMigration()

  assert.ok(
    basename(path) > '20260830002000_hmac_fixed_work_compare.sql',
    'Task 7 debe usar una migración posterior a Task 6',
  )

  const expected = {
    deposito: ['monto', 'referencia'],
    solicitud: ['descripcion', 'monto'],
    lead: [
      'coordenada',
      'detalles',
      'direccion',
      'documento',
      'email',
      'municipio_id',
      'monto_estimado',
      'nombre',
      'origen_id',
      'telefono',
    ],
    visita: [
      'actividad_hora_id',
      'actividad_id',
      'comentario',
      'departamento_id',
      'direccion',
      'fecha_visita',
      'hora_inicio',
      'municipio_id',
      'persona_id',
      'persona_nombre',
      'sub_actividad_id',
      'zona_id',
    ],
  }

  for (const [table, columns] of Object.entries(expected)) {
    assert.match(
      source,
      new RegExp(
        `revoke\\s+update\\s+on\\s+(?:table\\s+)?public\\.${table}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,
        'i',
      ),
      `${table} debe perder UPDATE de tabla para todos los roles API`,
    )
    assert.deepEqual(grantedColumns(source, table), [...columns].sort())
  }

  assert.doesNotMatch(
    source,
    /\bgrant\s+update\s+on\s+(?:table\s+)?public\.(?:deposito|solicitud|lead|visita)\b/i,
  )
  assert.doesNotMatch(source, /\b(?:current_setting|set_config)\s*\(/i)
  assert.doesNotMatch(source, /\b(?:drop\s+policy|disable\s+row\s+level\s+security)\b/i)
  assert.match(
    source,
    /alter\s+table\s+public\.visita\s+add\s+column\s+if\s+not\s+exists\s+actualizado_en\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i,
  )
})

test('el pgTAP es autónomo y cubre RED directo, RPC y edición no-estado', async () => {
  const source = await readFile(pgtapPath, 'utf8')
  const planned = Number(source.match(/\bselect\s+plan\((\d+)\)/i)?.[1])
  const assertions = source.match(
    /^select\s+(?:ok|is|throws_ok|lives_ok)\s*\(/gim,
  ) ?? []

  assert.equal(planned, 27)
  assert.equal(assertions.length, planned, 'el plan pgTAP debe coincidir con sus aserciones')
  assert.match(source, /^\s*begin;/i)
  assert.match(source, /select\s+\*\s+from\s+finish\(\);\s*rollback;\s*$/i)
  assert.match(source, /insert\s+into\s+auth\.users/i)
  assert.match(source, /insert\s+into\s+public\.tenant/i)

  const stateColumns = {
    deposito: 'estado',
    solicitud: 'estado_id',
    lead: 'estado_id',
    visita: 'estado',
  }
  const canonicalRpcs = {
    deposito: 'deposito_confirmar',
    solicitud: 'solicitud_transicion',
    lead: 'lead_transicion',
    visita: 'visita_completar',
  }
  for (const [table, column] of Object.entries(stateColumns)) {
    assert.match(
      source,
      new RegExp(
        `throws_ok\\([\\s\\S]*?update\\s+public\\.${table}\\s+set\\s+${column}\\b[\\s\\S]*?'42501'`,
        'i',
      ),
      `falta prueba de rechazo para ${table}.${column}`,
    )
    assert.match(
      source,
      new RegExp(`lives_ok\\([\\s\\S]*?public\\.${canonicalRpcs[table]}\\s*\\(`, 'i'),
      `falta prueba de vida para ${canonicalRpcs[table]}`,
    )
  }

  for (const table of Object.keys(stateColumns)) {
    assert.match(
      source,
      new RegExp(
        `lives_ok\\([\\s\\S]*?update\\s+public\\.${table}\\b`,
        'i',
      ),
      `falta una edición no-estado permitida para ${table}`,
    )
  }
})
