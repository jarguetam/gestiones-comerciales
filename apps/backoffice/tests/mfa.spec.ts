import { expect, test } from '@playwright/test'

test.describe('P-01 login (sin demo)', () => {
  test('login visible y sin Entrar al backoffice', async ({ page }) => {
    await page.goto('/#/login')
    await expect(page.locator('[data-spec="P-01"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /^ingresar$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar al backoffice/i })).toHaveCount(0)
  })

  test('sin sesión redirige a login', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-spec="P-01"]')).toBeVisible()
    await expect(page.getByRole('link', { name: /empresas/i })).toHaveCount(0)
  })
})
