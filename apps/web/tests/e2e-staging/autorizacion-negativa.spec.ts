/**
 * E2E post-merge contra Vite + Supabase staging.
 * Login con usuarios sintéticos; sin botón de demostración.
 */
import { expect, test } from '@playwright/test'

const asesorEmail = process.env.E2E_ASESOR_EMAIL ?? 'asesor@staging.test'
const asesorPassword = process.env.E2E_ASESOR_PASSWORD ?? ''

test.describe('autorización negativa (staging)', () => {
  test('login sintético llega al tablero', async ({ page }) => {
    test.skip(!asesorPassword, 'E2E_ASESOR_PASSWORD requerido en Environment staging')
    await page.goto('/#/login')
    await expect(page.locator('[data-spec="W-01"]')).toBeVisible()
    await page.getByLabel(/^email$/i).fill(asesorEmail)
    await page.getByLabel(/^contraseña$/i).fill(asesorPassword)
    await page.getByRole('button', { name: /^ingresar$/i }).click()
    await expect(page.getByRole('link', { name: /dashboard|hoy|jornada/i }).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('asesor no ve la administración de usuarios', async ({ page }) => {
    test.skip(!asesorPassword, 'E2E_ASESOR_PASSWORD requerido en Environment staging')
    await page.goto('/#/login')
    await page.getByLabel(/^email$/i).fill(asesorEmail)
    await page.getByLabel(/^contraseña$/i).fill(asesorPassword)
    await page.getByRole('button', { name: /^ingresar$/i }).click()
    await page.goto('/#/usuarios')
    const admin = page.locator('[data-spec="W-11"]')
    const blocked = page.getByText(/sin permiso|no autorizado|ingresá|entrar/i)
    await expect(admin.or(blocked).first()).toBeVisible({ timeout: 15_000 })
    if (await admin.count()) {
      await expect(page.getByRole('button', { name: /invitar|crear usuario/i })).toHaveCount(0)
    }
  })
})
