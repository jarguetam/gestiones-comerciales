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
): Promise<void> {
  await logoutCleanup({
    userId: perfil.id,
    tenantId: perfil.tenantId,
    deleteSession: async () => {
      await cliente.auth.signOut()
      await borrarSesionLocal()
    },
    clearCola,
    invalidateFcm: () => invalidateFcmToken(cliente, perfil.id),
  })
}
