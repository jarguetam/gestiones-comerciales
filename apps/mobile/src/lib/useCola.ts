import { useEffect, useState } from 'react'
import { contarPendientes, resumenCola } from './cola'
import { leerCola, suscribirCola } from './colaStore'

export function useCola() {
  const [, setTick] = useState(0)
  useEffect(() => suscribirCola(() => setTick((n) => n + 1)), [])
  const items = leerCola()
  return {
    items,
    pendientes: contarPendientes(items),
    resumen: resumenCola(items),
  }
}
