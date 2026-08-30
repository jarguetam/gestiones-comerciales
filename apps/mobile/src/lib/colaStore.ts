import {
  encolar,
  procesarCola,
  type AltaCola,
  type ItemCola,
} from './cola'
import type { ColaPersist } from './colaPersistencia'

let items: ItemCola[] = []
let persist: ColaPersist | null = null
const listeners = new Set<() => void>()

function publicar(next: ItemCola[]) {
  items = next
  for (const fn of listeners) fn()
  if (persist) void persist.save(next)
}

export function configurarPersistencia(p: ColaPersist | null) {
  persist = p
}

export async function hidratarDesdePersistencia() {
  if (!persist) return
  const loaded = await persist.load()
  if (loaded && loaded.length > 0) publicar(loaded)
}

export function leerCola(): ItemCola[] {
  return items
}

export function suscribirCola(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function hidratarCola(inicial: ItemCola[]) {
  publicar(inicial)
}

export function encolarMutacion(alta: AltaCola) {
  publicar(encolar(items, alta))
}

export async function encolarYSync(
  alta: AltaCola,
  ejecutar: (item: ItemCola) => Promise<void>,
) {
  publicar(encolar(items, alta))
  return sincronizarAhora(ejecutar)
}

export async function sincronizarAhora(ejecutar: (item: ItemCola) => Promise<void>, ahora = Date.now()) {
  const next = await procesarCola(items, ejecutar, ahora)
  publicar(next)
  return next
}
