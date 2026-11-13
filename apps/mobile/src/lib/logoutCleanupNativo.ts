import type { SupabaseClient } from '@supabase/supabase-js'
import { logoutCleanup } from './logoutCleanup'
import { CLAVE_SESION } from './supabase'
import { cerrarSesionYBorrar } from './sesionBorrar'
import { sesionStorage } from './sesionStorage'

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
    deleteSession: () => cerrarSesionYBorrar(cliente, sesionStorage, CLAVE_SESION),
    pendientes,
    clearCola,
    clearCache,
    invalidateFcm: () => invalidateFcmToken(cliente, perfil.id),
  })
}
