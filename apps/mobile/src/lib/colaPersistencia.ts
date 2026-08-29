import type { ItemCola } from './cola'

const TIPOS = new Set([
  'visita_checkin',
  'visita_completar',
  'formulario_enviar',
  'deposito',
  'solicitud',
  'persona',
  'lead',
])

const ESTADOS = new Set(['pendiente', 'enviado', 'error'])

export function serializarCola(items: ItemCola[]): string {
  return JSON.stringify(items)
}

function esItem(value: unknown): value is ItemCola {
  if (!value || typeof value !== 'object') return false
  const i = value as Record<string, unknown>
  return (
    typeof i.id === 'string' &&
    typeof i.clienteKey === 'string' &&
    TIPOS.has(String(i.tipo)) &&
    ESTADOS.has(String(i.estado)) &&
    typeof i.payload === 'object' &&
    i.payload !== null
  )
}

export function deserializarCola(json: string): ItemCola[] {
  if (!json.trim()) return []
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(esItem)
  } catch {
    return []
  }
}

export const COLA_DDL = `
create table if not exists cola_estado (
  id integer primary key check (id = 1),
  json text not null
);
`

export interface SqliteRunner {
  exec(sql: string, params?: unknown[]): void | Promise<void>
  first(sql: string, params?: unknown[]): { json: string } | undefined | Promise<{ json: string } | undefined>
}

export interface ColaPersist {
  load(): Promise<ItemCola[] | null>
  save(items: ItemCola[]): Promise<void>
}

export async function initColaSqlite(db: SqliteRunner): Promise<void> {
  await db.exec(COLA_DDL)
}

export async function loadColaSqlite(db: SqliteRunner): Promise<ItemCola[] | null> {
  const row = await db.first('select json from cola_estado where id = 1')
  if (!row?.json) return null
  return deserializarCola(row.json)
}

export async function saveColaSqlite(db: SqliteRunner, items: ItemCola[]): Promise<void> {
  await db.exec(
    'insert into cola_estado (id, json) values (1, ?) on conflict(id) do update set json = excluded.json',
    [serializarCola(items)],
  )
}

export function persistenciaSqlite(db: SqliteRunner): ColaPersist {
  let listo: Promise<void> | null = null
  const asegurar = () => {
    if (!listo) listo = initColaSqlite(db)
    return listo
  }
  return {
    async load() {
      await asegurar()
      return loadColaSqlite(db)
    },
    async save(items) {
      await asegurar()
      await saveColaSqlite(db, items)
    },
  }
}

export function persistenciaMemoria(inicial: ItemCola[] = []): ColaPersist {
  let json = inicial.length ? serializarCola(inicial) : null
  return {
    async load() {
      return json ? deserializarCola(json) : null
    },
    async save(items) {
      json = serializarCola(items)
    },
  }
}
