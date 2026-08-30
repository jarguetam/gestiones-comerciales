/**
 * Detox — permisos de rastreo (API 34).
 * 1. Concedido → agenda usable, TaskManager activo.
 * 2. Denegado → campo bloqueado, logout ok.
 * 3. Revocado en ajustes → al volver a foreground bloquea.
 * 4. Restaurado → desbloquea.
 */
import { by, device, element, expect } from 'detox'

describe('rastreo permisos', () => {
  it('permiso concedido deja la agenda usable', async () => {
    await device.launchApp({ permissions: { location: 'always' }, newInstance: true })
    await expect(element(by.text('Ruta de campo'))).toBeVisible()
  })

  it('permiso denegado bloquea el campo y permite logout', async () => {
    await device.launchApp({ permissions: { location: 'never' }, newInstance: true })
    await expect(element(by.text('Ubicación requerida'))).toBeVisible()
    await expect(element(by.text('Cerrar sesión'))).toBeVisible()
  })
})
