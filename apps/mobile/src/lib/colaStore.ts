import {
  demoCola,
  encolar,
  procesarCola,
  type AltaCola,
  type ItemCola,
} from './cola'
import {
  type AlmacenCola,
  claveCola,
  hidratarColaJson,
  serializarCola,
} from './colaPersist'

let items: ItemCola[] = []
const listeners = new Set<() => void>()
let almacen: AlmacenCola | null = null
let clave = claveCola('anon')

function publicar(next: ItemCola[]) {
  items = next
  for (const fn of listeners) fn()
  if (almacen) {
    void almacen.setItem(clave, serializarCola(items))
  }
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

export function configurarPersistencia(store: AlmacenCola | null, userId = 'anon') {
  almacen = store
  clave = claveCola(userId)
}

export async function hidratarDesdeAlmacen(fallback: ItemCola[]): Promise<ItemCola[]> {
  if (!almacen) {
    publicar(fallback)
    return fallback
  }
  const raw = await almacen.getItem(clave)
  const hidratada = hidratarColaJson(raw)
  const next = hidratada ?? fallback
  publicar(next)
  return next
}

export function resetColaDemo() {
  publicar(demoCola())
}

export function vaciarCola() {
  publicar([])
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
