import { strict as assert } from 'node:assert'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { cacheMemoria, cacheSqlite } from '../src/lib/cacheCampo.ts'
import type { SqliteRunner } from '../src/lib/colaPersistencia.ts'

function runnerDe(db: DatabaseSync): SqliteRunner {
  return {
    exec(sql, params = []) { db.prepare(sql).run(...params as never[]) },
    first(sql, params = []) { return db.prepare(sql).get(...params as never[]) as { json: string } | undefined },
  }
}

test('guarda y lee con la fecha de guardado', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    const cache = cacheSqlite(runnerDe(db))
    await cache.guardar('t1:u1', 'agenda', [1], new Date('2026-11-14T08:00:00Z'))
    assert.deepEqual(await cache.leer('t1:u1', 'agenda'), { datos: [1], guardadoEn: '2026-11-14T08:00:00.000Z' })
    await cache.guardar('t1:u1', 'agenda', [2], new Date('2026-11-15T08:00:00Z'))
    assert.deepEqual(await cache.leer('t1:u1', 'agenda'), { datos: [2], guardadoEn: '2026-11-15T08:00:00.000Z' })
  } finally { db.close() }
})

test('otra sesión no ve la caché', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    const cache = cacheSqlite(runnerDe(db))
    await cache.guardar('t1:u1', 'agenda', [1])
    assert.equal(await cache.leer('t1:u2', 'agenda'), null)
    assert.equal(await cache.leer('t1:u1', 'perfil'), null)
  } finally { db.close() }
})

test('json corrupto se trata como sin caché', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    const cache = cacheSqlite(runnerDe(db))
    await cache.guardar('t1:u1', 'agenda', [1])
    db.prepare('update cache_campo set json = ? where clave = ? and tipo = ?').run('{', 't1:u1', 'agenda')
    assert.equal(await cache.leer('t1:u1', 'agenda'), null)
  } finally { db.close() }
})

test('limpiar borra solo esa sesión', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    const cache = cacheSqlite(runnerDe(db))
    await cache.guardar('t1:u1', 'agenda', [1])
    await cache.guardar('t1:u1', 'perfil', { a: 1 })
    await cache.guardar('t1:u2', 'agenda', [2])
    await cache.limpiar('t1:u1')
    assert.equal(await cache.leer('t1:u1', 'agenda'), null)
    assert.equal(await cache.leer('t1:u1', 'perfil'), null)
    assert.deepEqual((await cache.leer<number[]>('t1:u2', 'agenda'))?.datos, [2])
  } finally { db.close() }
})

test('cacheMemoria respeta la misma partición', async () => {
  const cache = cacheMemoria()
  await cache.guardar('t1:u1', 'catalogos', ['x'], new Date('2026-11-14T08:00:00Z'))
  assert.deepEqual(await cache.leer('t1:u1', 'catalogos'), { datos: ['x'], guardadoEn: '2026-11-14T08:00:00.000Z' })
  assert.equal(await cache.leer('t1:u2', 'catalogos'), null)
  await cache.limpiar('t1:u1')
  assert.equal(await cache.leer('t1:u1', 'catalogos'), null)
})
