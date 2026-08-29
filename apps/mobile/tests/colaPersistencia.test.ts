import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { demoCola, type ItemCola } from '../src/lib/cola.ts'
import {
  COLA_DDL,
  deserializarCola,
  initColaSqlite,
  loadColaSqlite,
  saveColaSqlite,
  serializarCola,
  type SqliteRunner,
} from '../src/lib/colaPersistencia.ts'

test('serializarCola roundtrip conserva clienteKey y estado', () => {
  const original = demoCola()
  const json = serializarCola(original)
  const back = deserializarCola(json)
  assert.equal(back.length, original.length)
  assert.deepEqual(
    back.map((i) => i.clienteKey),
    original.map((i) => i.clienteKey),
  )
  assert.equal(back[0].tipo, 'visita_checkin')
})

test('deserializarCola rechaza JSON corrupto', () => {
  assert.deepEqual(deserializarCola(''), [])
  assert.deepEqual(deserializarCola('{no-json'), [])
  assert.deepEqual(deserializarCola('{"no":"cola"}'), [])
})

class MemoriaSqlite implements SqliteRunner {
  json: string | null = null
  ddl = ''

  exec(sql: string, params: unknown[] = []): void {
    if (sql.includes('create table')) {
      this.ddl = sql
      return
    }
    if (sql.includes('insert into cola_estado') || sql.includes('on conflict')) {
      this.json = String(params[0] ?? '')
    }
  }

  first(sql: string): { json: string } | undefined {
    if (sql.includes('select json') && this.json != null) return { json: this.json }
    return undefined
  }
}

test('cola SQLite guarda y recarga la cola tras init', async () => {
  const db = new MemoriaSqlite()
  await initColaSqlite(db)
  assert.match(db.ddl, /cola_estado/)
  assert.match(COLA_DDL, /cola_estado/)

  const items: ItemCola[] = demoCola().slice(0, 2)
  await saveColaSqlite(db, items)
  const loaded = await loadColaSqlite(db)
  assert.equal(loaded?.length, 2)
  assert.equal(loaded?.[0].clienteKey, items[0].clienteKey)
})
