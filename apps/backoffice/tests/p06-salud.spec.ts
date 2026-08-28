/**
 * P-06 — E2E de salud de plataforma en modo demo (sin backend).
 */
import { expect, test } from '@playwright/test'

test.describe('P-06 salud de plataforma (modo demo)', () => {
  test('el menú incluye Salud y muestra P-06', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^salud$/i }).first().click()
    await expect(page.getByText(/P-06/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /salud de plataforma/i })).toBeVisible()
  })

  test('muestra jobs pg_cron con estados y uso por empresa', async ({ page }) => {
    await page.goto('/salud')
    await expect(page.getByRole('heading', { name: /jobs pg_cron/i })).toBeVisible()
    await expect(page.getByText('notify-jobs-recordatorio-agenda')).toBeVisible()
    await expect(page.getByText('snapshot-cuentas')).toBeVisible()
    await expect(page.getByText('Falló').first()).toBeVisible()
    await expect(page.getByText('No programado').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /uso por empresa/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /agromoney/i })).toBeVisible()
    await expect(page.getByText('Errores 24 h')).toBeVisible()
    await expect(page.getByText('Dispositivos')).toBeVisible()
  })

  test('desde Empresas se entra a salud', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /ver salud/i }).click()
    await expect(page.getByRole('heading', { name: /salud de plataforma/i })).toBeVisible()
  })
})
