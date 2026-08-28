import {
  demoCola,
  encolar,
  procesarCola,
  type AltaCola,
  type ItemCola,
} from './cola'

let items: ItemCola[] = demoCola()
const listeners = new Set<() => void>()

function publicar(next: ItemCola[]) {
  items = next
  for (const fn of listeners) fn()
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

export function resetColaDemo() {
  publicar(demoCola())
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
