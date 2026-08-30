import type { ItemCola } from './cola'

export function claveParticionCola(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`
}

export interface ColaParticionPersist {
  load(clave: string): Promise<ItemCola[] | null>
  save(clave: string, items: ItemCola[]): Promise<void>
  clear(clave: string): Promise<void>
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
