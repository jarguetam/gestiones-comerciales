/**
 * Backoffice staging: JWT de empresa → 403. MFA de plataforma se saltea
 * sin E2E_PLATFORM_PASSWORD (factor seed todavía no está en el job).
 */
import { expect, test } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@staging.test'
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? ''
const platformEmail = process.env.E2E_PLATFORM_EMAIL ?? ''
const platformPassword = process.env.E2E_PLATFORM_PASSWORD ?? ''

test.describe('backoffice staging', () => {
  test('JWT de empresa no entra al chrome de plataforma', async ({ page }) => {
    test.skip(!adminPassword, 'E2E_ADMIN_PASSWORD requerido')
    await page.goto('/#/login')
    await expect(page.locator('[data-spec="P-01"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar al backoffice/i })).toHaveCount(0)
    await page.getByLabel(/^email$/i).fill(adminEmail)
    await page.getByLabel(/^contraseña$/i).fill(adminPassword)
    await page.getByRole('button', { name: /^ingresar$/i }).click()
    await expect(page.getByText(/sin acceso|GC-AUTH-001/i)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('link', { name: /empresas|catálogos|salud/i })).toHaveCount(0)
  })

  test('plataforma con TOTP llega al listado de tenants', async ({ page }) => {
    test.skip(!platformEmail || !platformPassword, 'E2E_PLATFORM_EMAIL/PASSWORD no sembrados')
    await page.goto('/#/login')
    await page.getByLabel(/^email$/i).fill(platformEmail)
    await page.getByLabel(/^contraseña$/i).fill(platformPassword)
    await page.getByRole('button', { name: /^ingresar$/i }).click()
    const enroll = page.getByText(/autenticador|TOTP|enrol/i)
    const lista = page.getByRole('heading', { name: /empresas/i })
    await expect(enroll.or(lista).first()).toBeVisible({ timeout: 20_000 })
  })
})
