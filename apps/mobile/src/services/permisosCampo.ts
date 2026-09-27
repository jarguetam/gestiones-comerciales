export type CampoAccess = 'ok' | 'blocked_location'

export type ConsultaPermisoUbicacion = () => Promise<{ status: string; canAskAgain?: boolean }>

export const TEXTO_PERMISO_UBICACION =
  'Gestiones Comerciales recopila datos de ubicación para registrar visitas y el recorrido de campo durante la jornada configurada por tu empresa, incluso en segundo plano cuando la app no está en uso. La empresa que administra tu cuenta puede consultar el recorrido. No usamos estos datos para publicidad.'

export const TEXTO_PERMISO_VISITA =
  'Gestiones Comerciales solicita tu ubicación mientras usas la app para registrar el check-in de tus visitas.'

export async function solicitarPermisosCampo(
  pedirPrimerPlano: ConsultaPermisoUbicacion,
  pedirSegundoPlano?: ConsultaPermisoUbicacion,
): Promise<'ok' | 'blocked_location' | 'blocked_background'> {
  const primerPlano = await pedirPrimerPlano()
  if (primerPlano.status !== 'granted') return 'blocked_location'
  if (!pedirSegundoPlano) return 'ok'
  const segundoPlano = await pedirSegundoPlano()
  return segundoPlano.status === 'granted' ? 'ok' : 'blocked_background'
}

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
