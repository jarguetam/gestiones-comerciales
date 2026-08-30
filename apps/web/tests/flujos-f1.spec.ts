/**
 * E2E post-demo (PR): Vite local + fixtures. Sin backend real → login, no tablero.
 */
import { expect, test } from '@playwright/test'

test.describe('F1 MVP web (login, sin demo)', () => {
  test('W-01: login visible y sin Entrar al tablero', async ({ page }) => {
    await page.goto('/#/login')
    await expect(page.locator('[data-spec="W-01"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /^ingresar$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar al tablero/i })).toHaveCount(0)
    await expect(page.getByLabel(/^email$/i)).toBeVisible()
    await expect(page.getByLabel(/^contraseña$/i)).toBeVisible()
  })

  test('sin sesión redirige a login, no abre el tablero', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-spec="W-01"]')).toBeVisible()
    await expect(page.getByRole('link', { name: /dashboard/i })).toHaveCount(0)
  })

  test('sin backend muestra GC-CORE-001', async ({ page }) => {
    await page.goto('/#/login')
    await expect(page.getByText(/GC-CORE-001/)).toBeVisible()
  })
})
