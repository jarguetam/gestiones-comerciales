export type CampoAccess = 'ok' | 'blocked_location'

export type ConsultaPermisoUbicacion = () => Promise<{ status: string; canAskAgain?: boolean }>

async function consultaNativa(): Promise<{ status: string; canAskAgain?: boolean }> {
  const Location = await import('expo-location')
  return Location.getForegroundPermissionsAsync()
}

export async function resolveCampoAccess(
  consultar: ConsultaPermisoUbicacion = consultaNativa,
): Promise<CampoAccess> {
  const { status } = await consultar()
  if (status === 'granted') return 'ok'
  return 'blocked_location'
}
