import type { SqliteRunner } from './colaPersistencia.ts'

export type TipoCache = 'catalogos' | 'agenda' | 'perfil'

export interface Guardado<T> {
  datos: T
  guardadoEn: string
}

export interface CacheCampo {
  leer<T>(clave: string, tipo: TipoCache): Promise<Guardado<T> | null>
  guardar<T>(clave: string, tipo: TipoCache, datos: T, ahora?: Date): Promise<void>
  limpiar(clave: string): Promise<void>
}

/** La caché no es fuente de verdad: una fila ilegible cuenta como "sin caché". */
function parsear<T>(json: string): Guardado<T> | null {
  try {
    const v = JSON.parse(json) as Partial<Guardado<T>> | null
    if (v && typeof v === 'object' && 'datos' in v && typeof v.guardadoEn === 'string') {
      return { datos: v.datos as T, guardadoEn: v.guardadoEn }
    }
    return null
  } catch {
    return null
  }
}

export function cacheSqlite(db: SqliteRunner): CacheCampo {
  const listo = Promise.resolve(db.exec(`create table if not exists cache_campo (
    clave text not null,
    tipo text not null,
    json text not null,
    primary key (clave, tipo)
  )`))
  return {
    async leer<T>(clave: string, tipo: TipoCache) {
      await listo
      const row = await db.first('select json from cache_campo where clave = ? and tipo = ?', [clave, tipo])
      return row ? parsear<T>(row.json) : null
    },
    async guardar<T>(clave: string, tipo: TipoCache, datos: T, ahora: Date = new Date()) {
      await listo
      const json = JSON.stringify({ datos, guardadoEn: ahora.toISOString() })
      await db.exec(
        'insert into cache_campo (clave, tipo, json) values (?, ?, ?) on conflict(clave, tipo) do update set json = excluded.json',
        [clave, tipo, json],
      )
    },
    async limpiar(clave) {
      await listo
      await db.exec('delete from cache_campo where clave = ?', [clave])
    },
  }
}

export function cacheMemoria(): CacheCampo {
  const map = new Map<string, string>()
  const k = (clave: string, tipo: TipoCache) => `${clave}\u0000${tipo}`
  return {
    async leer<T>(clave: string, tipo: TipoCache) {
      const json = map.get(k(clave, tipo))
      return json === undefined ? null : parsear<T>(json)
    },
    async guardar<T>(clave: string, tipo: TipoCache, datos: T, ahora: Date = new Date()) {
      map.set(k(clave, tipo), JSON.stringify({ datos, guardadoEn: ahora.toISOString() }))
    },
    async limpiar(clave) {
      const prefijo = `${clave}\u0000`
      for (const key of [...map.keys()]) if (key.startsWith(prefijo)) map.delete(key)
    },
  }
}
