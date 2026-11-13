import type { SqliteRunner } from './colaPersistencia'
import { cacheSqlite, type CacheCampo } from './cacheCampo'
import * as SQLite from 'expo-sqlite'

let instancia: CacheCampo | null = null

/** Instancia única, abierta en el primer uso; comparte `gc-cola.db` con la cola. */
export function abrirCacheCampo(): CacheCampo {
  if (!instancia) {
    const db = SQLite.openDatabaseSync('gc-cola.db')
    const runner: SqliteRunner = {
      exec(sql, params = []) {
        db.runSync(sql, params as never)
      },
      first(sql, params = []) {
        return db.getFirstSync<{ json: string }>(sql, params as never) ?? undefined
      },
    }
    instancia = cacheSqlite(runner)
  }
  return instancia
}
