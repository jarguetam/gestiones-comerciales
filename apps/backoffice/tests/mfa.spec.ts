import { expect, test } from '@playwright/test'

test.describe('P-01 MFA (modo demo)', () => {
  test('el menú incluye MFA y permite enrolar TOTP de demostración', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^mfa$/i }).first().click()
    await expect(page.getByText(/P-01/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /mfa totp/i })).toBeVisible()
    await expect(page.getByText(/Authy \(demo\)/i)).toBeVisible()
    await page.getByRole('button', { name: /enrolar totp/i }).click()
    await expect(page.getByAltText(/qr totp/i)).toBeVisible()
    await page.getByPlaceholder(/código de 6 dígitos/i).fill('123456')
    await page.getByRole('button', { name: /confirmar código/i }).click()
    await expect(page.getByText(/factor totp verificado/i)).toBeVisible()
  })
})
