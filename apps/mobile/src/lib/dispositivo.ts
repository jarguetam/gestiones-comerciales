/** Registro del token FCM nativo en `dispositivo` tras login (spec §3.1). */

import { Platform } from 'react-native'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function registrarDispositivo(
  cliente: SupabaseClient,
  usuarioId: string,
  tokenFcm: string,
): Promise<void> {
  const plataforma = Platform.OS === 'ios' ? 'ios' : 'android'
  const { error } = await cliente.from('dispositivo').upsert(
    {
      usuario_id: usuarioId,
      token_fcm: tokenFcm,
      plataforma,
      activo: true,
    },
    { onConflict: 'usuario_id,token_fcm' },
  )
  if (error) throw error
}
