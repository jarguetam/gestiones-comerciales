import type { ItemCola } from './cola'
import { deserializarColaEstricto, serializarCola, type SqliteRunner } from './colaPersistencia.ts'

export function claveParticionCola(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`
}

export interface ColaParticionPersist {
  load(clave: string): Promise<ItemCola[] | null>
  save(clave: string, items: ItemCola[]): Promise<void>
  clear(clave: string): Promise<void>
}

export function persistenciaSqliteParticionada(db: SqliteRunner): ColaParticionPersist {
  const listo = Promise.resolve(db.exec(`create table if not exists cola_particion (
    clave text primary key,
    json text not null
  )`))
  return {
    async load(clave) {
      await listo
      const row = await db.first('select json from cola_particion where clave = ?', [clave])
      return row ? deserializarColaEstricto(row.json) : null
    },
    async save(clave, items) {
      await listo
      await db.exec('insert into cola_particion (clave, json) values (?, ?) on conflict(clave) do update set json = excluded.json', [clave, serializarCola(items)])
    },
    async clear(clave) {
      await listo
      await db.exec('delete from cola_particion where clave = ?', [clave])
    },
  }
}

export function persistenciaMemoriaParticionada(
  inicial: Record<string, ItemCola[]> = {},
): ColaParticionPersist {
  const map = new Map<string, string>()
  for (const [k, v] of Object.entries(inicial)) map.set(k, JSON.stringify(v))
  return {
    async load(clave) {
      const json = map.get(clave)
      if (!json) return null
      try {
        const parsed = JSON.parse(json) as ItemCola[]
        return Array.isArray(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    async save(clave, items) {
      map.set(clave, JSON.stringify(items))
    },
    async clear(clave) {
      map.delete(clave)
    },
  }
}
