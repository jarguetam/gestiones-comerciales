import { persistenciaMemoria, persistenciaSqlite, type ColaPersist, type SqliteRunner } from './colaPersistencia'
import { DEMO_MODE } from './supabase'
import * as SQLite from 'expo-sqlite'

/** Abre SQLite nativo; en demo degrada a memoria. */
export async function abrirPersistenciaCola(): Promise<ColaPersist> {
  if (DEMO_MODE) return persistenciaMemoria()
  try {
    const db = SQLite.openDatabaseSync('gc-cola.db')
    const runner: SqliteRunner = {
      exec(sql, params = []) {
        db.runSync(sql, params as never)
      },
      first(sql, params = []) {
        return db.getFirstSync<{ json: string }>(sql, params as never) ?? undefined
      },
    }
    return persistenciaSqlite(runner)
  } catch {
    return persistenciaMemoria()
  }
}
