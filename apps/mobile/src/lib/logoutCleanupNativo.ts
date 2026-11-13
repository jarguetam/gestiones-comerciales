import * as SecureStore from 'expo-secure-store'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logoutCleanup } from './logoutCleanup'
import { sesionStorage } from './sesionStorage'

export async function borrarSesionLocal(): Promise<void> {
  await sesionStorage.removeItem('supabase.session')
  await SecureStore.deleteItemAsync('supabase.session').catch(() => undefined)
}

export async function invalidateFcmToken(cliente: SupabaseClient, usuarioId: string): Promise<void> {
  const { error } = await cliente.from('dispositivo').update({ activo: false }).eq('usuario_id', usuarioId)
  if (error) throw error
}

export async function logoutCleanupNativo(
  cliente: SupabaseClient,
  perfil: { id: string; tenantId: string },
  clearCola: (clave: string) => Promise<void>,
  pendientes: number,
  clearCache: (clave: string) => Promise<void>,
): Promise<{ colaConservada: boolean }> {
  return logoutCleanup({
    userId: perfil.id,
    tenantId: perfil.tenantId,
    deleteSession: async () => {
      const { error } = await cliente.auth.signOut()
      if (error) {
        // Sin red el cierre global falla y supabase-js conserva la sesión: se fuerza el cierre local.
        console.warn('GC-AUTH-027: no se pudo cerrar sesión en el servidor, se cierra solo en el teléfono', error)
        await cliente.auth.signOut({ scope: 'local' })
      }
      await borrarSesionLocal()
    },
    pendientes,
    clearCola,
    clearCache,
    invalidateFcm: () => invalidateFcmToken(cliente, perfil.id),
  })
}
