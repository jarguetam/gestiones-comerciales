import {
  bloqueadoPorDependencia,
  encolar,
  intentarItem,
  reactivar,
  reintentables,
  type AltaCola,
  type ItemCola,
} from './cola.ts'
import type { ColaPersist } from './colaPersistencia'

interface ContextoCola {
  items: ItemCola[]
  persist: ColaPersist | null
  escritura: Promise<void>
  sync: Promise<ItemCola[]> | null
  revision: number
  clave?: string
}

function contexto(persist: ColaPersist | null, clave?: string): ContextoCola {
  return { items: [], persist, escritura: Promise.resolve(), sync: null, revision: 0, clave }
}

let activo = contexto(null)
const listeners = new Set<() => void>()

function notificar(ctx: ContextoCola) {
  if (ctx === activo) for (const fn of listeners) fn()
}

function encolarEscritura(ctx: ContextoCola, guardar: () => Promise<void>): Promise<void> {
  // El error de una operación llega a su llamador; la siguiente puede reintentar.
  ctx.escritura = ctx.escritura.then(guardar, guardar)
  return ctx.escritura
}

function publicar(next: ItemCola[], ctx = activo): Promise<void> {
  ctx.items = next
  notificar(ctx)
  const guardar = async () => { await ctx.persist?.save(next) }
  return encolarEscritura(ctx, guardar)
}

export function configurarPersistencia(p: ColaPersist | null, clave?: string) {
  activo = contexto(p, clave)
  notificar(activo)
}

export async function hidratarDesdePersistencia() {
  const ctx = activo
  const revision = ctx.revision
  const loaded = await ctx.persist?.load()
  if (ctx !== activo || revision !== ctx.revision) return
  const actuales = new Map(ctx.items.map((i) => [i.id, i]))
  ctx.items = [...(loaded ?? []).filter((i) => !actuales.has(i.id)), ...ctx.items]
  notificar(ctx)
}

export function leerCola(): ItemCola[] {
  return activo.items
}

export function suscribirCola(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function hidratarCola(inicial: ItemCola[]) {
  return publicar(inicial)
}

export async function clearCola(clave?: string) {
  if (clave !== undefined && clave !== activo.clave) {
    throw new Error('La cola no pertenece a esta sesión (GC-CORE-001)')
  }
  const ctx = activo
  ctx.revision++
  ctx.items = []
  notificar(ctx)
  await encolarEscritura(ctx, async () => {
    if (ctx.persist?.clear) await ctx.persist.clear()
    else await ctx.persist?.save([])
  })
}

export async function encolarMutacion(alta: AltaCola, clave?: string) {
  if (!activo.persist || activo.clave !== clave) {
    throw new Error('El almacenamiento no está listo para esta sesión (GC-CORE-001)')
  }
  return publicar(encolar(activo.items, alta))
}

export async function reactivarItem(id: string, clave?: string): Promise<void> {
  if (!activo.persist || activo.clave !== clave) {
    throw new Error('El almacenamiento no está listo para esta sesión (GC-CORE-001)')
  }
  return publicar(reactivar(activo.items, id))
}

export async function encolarYSync(
  alta: AltaCola,
  ejecutar: (item: ItemCola) => Promise<void>,
  clave?: string,
) {
  const ctx = activo
  await encolarMutacion(alta, clave)
  if (ctx !== activo) return ctx.items
  return sincronizarAhora(ejecutar, Date.now(), clave)
}

/**
 * Para pantallas: espera solo el guardado durable (la captura ya no se pierde) y arranca
 * el envío sin esperarlo. `envio` se resuelve con el estado del ítem al terminar ese pase
 * (un rechazo del servidor queda en `estado: 'error'` con su `ultimoError`) y se rechaza
 * si el pase falla (disco, sesión). Quien lo use debe manejar ambos casos.
 */
export async function encolarEnFondo(
  alta: AltaCola,
  ejecutar: (item: ItemCola) => Promise<void>,
  clave?: string,
): Promise<{ envio: Promise<ItemCola | undefined> }> {
  const ctx = activo
  await encolarMutacion(alta, clave)
  const id = ctx.items.find((i) => i.clienteKey === alta.clienteKey && i.estado !== 'enviado')?.id
  if (ctx !== activo || id === undefined) return { envio: Promise.resolve(undefined) }
  const envio = sincronizarAhora(ejecutar, Date.now(), clave).then((items) => items.find((i) => i.id === id))
  return { envio }
}

export function sincronizarAhora(ejecutar: (item: ItemCola) => Promise<void>, ahora = Date.now(), clave?: string) {
  const ctx = activo
  if (!ctx.persist || ctx.clave !== clave) {
    return Promise.reject(new Error('La cola no pertenece a esta sesión (GC-CORE-001)'))
  }
  if (ctx.sync) return ctx.sync
  const revision = ctx.revision
  const vigente = () => ctx === activo && revision === ctx.revision
  ctx.sync = (async () => {
    // No enviar una captura que todavía pueda perderse al cerrar la app.
    await publicar(ctx.items, ctx)
    const lote = reintentables(ctx.items, ahora)
    for (const item of lote) {
      if (!vigente()) break
      // Contra el estado vivo: un check-in sale en este pase si su alta acaba de llegar.
      if (bloqueadoPorDependencia(item, ctx.items)) continue
      const { resultado, transitorio } = await intentarItem(item, ejecutar, ahora)
      if (!vigente()) break
      // El RPC solo reemplaza su elemento; conserva las altas concurrentes.
      await publicar(ctx.items.map((i) => i.id === item.id ? resultado : i), ctx)
      // Sin señal los siguientes fallarían igual: esperan intactos al próximo pase.
      if (transitorio) break
    }
    return ctx.items
  })().finally(() => { ctx.sync = null })
  return ctx.sync
}
