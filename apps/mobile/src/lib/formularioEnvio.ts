import type { AltaCola } from './cola'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function crearAltaFormulario(
  plantillaId: number | string,
  respuestas: Record<string, unknown>,
  visitaId: number | null,
  generarUuid: () => string,
): AltaCola {
  const clienteKey = generarUuid()
  if (!UUID_V4.test(clienteKey)) {
    throw new Error('No se pudo generar el identificador del formulario (GC-CORE-001)')
  }
  return {
    tipo: 'formulario_enviar',
    payload: { plantillaId, respuestas, visitaId },
    clienteKey,
  }
}
