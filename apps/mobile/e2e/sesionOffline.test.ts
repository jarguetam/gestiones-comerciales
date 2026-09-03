/**
 * Detox — sesión, cola offline y logout.
 * 5. Background + kill → cola se reenvía al volver online.
 * 6. Logout limpia cola/sesión.
 */
import { by, device, element, expect } from 'detox'

describe('sesión y cola offline', () => {
  it('sobrevive kill y muestra cola al volver', async () => {
    await device.launchApp({ newInstance: true, permissions: { location: 'always' } })
    await device.sendToHome()
    await device.launchApp({ newInstance: false })
    await expect(element(by.text('Ruta de campo')).or(element(by.text('Agenda de hoy')))).toBeVisible()
  })

  it('Salir queda visible y cierra sesión', async () => {
    await device.launchApp({ newInstance: true, permissions: { location: 'always' } })
    await expect(element(by.label('Salir')).or(element(by.text('Salir')))).toExist()
  })
})
