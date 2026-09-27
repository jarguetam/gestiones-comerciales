import { strict as assert } from 'node:assert'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import * as particion from '../src/lib/colaParticion.ts'
import * as colaStore from '../src/lib/colaStore.ts'
import { encolar } from '../src/lib/cola.ts'
import type { SqliteRunner } from '../src/lib/colaPersistencia.ts'

test('SQLite real separa usuarios y no atribuye la cola legada sin dueño', async () => {
  assert.equal(typeof particion.persistenciaSqliteParticionada, 'function')
  const db = new DatabaseSync(':memory:')
  try {
    const runner: SqliteRunner = {
      exec(sql, params = []) { db.prepare(sql).run(...params as never[]) },
      first(sql, params = []) { return db.prepare(sql).get(...params as never[]) as { json: string } | undefined },
    }
    db.exec("create table cola_estado (id integer primary key, json text); insert into cola_estado values (1, '[{\"id\":\"legado\"}]')")
    const store = particion.persistenciaSqliteParticionada(runner)
    const a = encolar([], { tipo: 'visita', payload: {}, clienteKey: 'a' })
    const b = encolar([], { tipo: 'persona', payload: {}, clienteKey: 'b' })
    assert.equal(await store.load('t:a'), null)
    await store.save('t:a', a)
    await store.save('t:b', b)
    assert.deepEqual(await store.load('t:a'), a)
    assert.deepEqual(await store.load('t:b'), b)
    await store.clear('t:a')
    assert.equal(await store.load('t:a'), null)
    assert.deepEqual(await store.load('t:b'), b)
    assert.equal(db.prepare('select count(*) as n from cola_estado').get()?.n, 1)
  } finally { db.close() }
})

test('una fila corrupta de SQLite falla sin convertir pendientes en cola vacía', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    const runner: SqliteRunner = {
      exec(sql, params = []) { db.prepare(sql).run(...params as never[]) },
      first(sql, params = []) { return db.prepare(sql).get(...params as never[]) as { json: string } | undefined },
    }
    const store = particion.persistenciaSqliteParticionada(runner)
    await store.save('t:a', encolar([], { tipo: 'visita', payload: {}, clienteKey: 'a' }))
    db.prepare('update cola_particion set json = ? where clave = ?').run('[{"id":"dañado"}]', 't:a')
    await assert.rejects(store.load('t:a'), /GC-CORE-001/)
    assert.equal(db.prepare('select json from cola_particion where clave = ?').get('t:a')?.json, '[{"id":"dañado"}]')
  } finally { db.close() }
})

test('logout elimina del disco solo la fila de la sesión activa', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    const runner: SqliteRunner = {
      exec(sql, params = []) { db.prepare(sql).run(...params as never[]) },
      first(sql, params = []) { return db.prepare(sql).get(...params as never[]) as { json: string } | undefined },
    }
    const pool = particion.persistenciaSqliteParticionada(runner)
    const a = encolar([], { tipo: 'persona', payload: {}, clienteKey: 'a' })
    const b = encolar([], { tipo: 'persona', payload: {}, clienteKey: 'b' })
    await pool.save('t:a', a)
    await pool.save('t:b', b)
    colaStore.configurarPersistencia({
      load: () => pool.load('t:a'),
      save: (items) => pool.save('t:a', items),
      clear: () => pool.clear('t:a'),
    }, 't:a')
    await colaStore.hidratarDesdePersistencia()
    await colaStore.clearCola('t:a')
    assert.equal(await pool.load('t:a'), null)
    assert.deepEqual(await pool.load('t:b'), b)
  } finally { db.close(); colaStore.configurarPersistencia(null) }
})
