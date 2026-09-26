import type { SqliteRunner } from './colaPersistencia'
import { persistenciaSqliteParticionada, type ColaParticionPersist } from './colaParticion'
import * as SQLite from 'expo-sqlite'

/** Un fallo de disco debe impedir la captura, nunca simular guardado en memoria. */
export async function abrirPersistenciaCola(): Promise<ColaParticionPersist> {
  const db = SQLite.openDatabaseSync('gc-cola.db')
  const runner: SqliteRunner = {
    exec(sql, params = []) {
      db.runSync(sql, params as never)
    },
    first(sql, params = []) {
      return db.getFirstSync<{ json: string }>(sql, params as never) ?? undefined
    },
  }
  return persistenciaSqliteParticionada(runner)
}
