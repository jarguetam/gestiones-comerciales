/**
 * Flujos Gate 3 §12.1 contra staging. Se saltean sin E2E_*_PASSWORD.
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const asesorEmail = process.env.E2E_ASESOR_EMAIL ?? 'asesor@staging.test'
const asesorPassword = process.env.E2E_ASESOR_PASSWORD ?? ''
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@staging.test'
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? ''

async function login(page: Page, email: string, password: string) {
  await page.goto('/#/login')
  await expect(page.locator('[data-spec="W-01"]')).toBeVisible()
  await expect(page.getByRole('button', { name: /entrar al tablero/i })).toHaveCount(0)
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/^contraseña$/i).fill(password)
  await page.getByRole('button', { name: /^ingresar$/i }).click()
  await expect(page.getByRole('link', { name: /dashboard|hoy|jornada/i }).first()).toBeVisible({
    timeout: 20_000,
  })
}

async function assertAxeOk(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const graves = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(graves, graves.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n')).toEqual([])
}

test.describe('flujos staging post-demo', () => {
  test('asesor entra a la jornada (W-03)', async ({ page }) => {
    test.skip(!asesorPassword, 'E2E_ASESOR_PASSWORD requerido')
    await login(page, asesorEmail, asesorPassword)
    await page.goto('/#/visitas')
    await expect(page.locator('[data-spec="W-03"]')).toBeVisible({ timeout: 15_000 })
    await assertAxeOk(page)
  })

  test('nueva visita (check-in de campo) abre el formulario', async ({ page }) => {
    test.skip(!asesorPassword, 'E2E_ASESOR_PASSWORD requerido')
    await login(page, asesorEmail, asesorPassword)
    await page.getByRole('button', { name: /nueva visita/i }).first().click()
    await expect(page.getByLabel(/cliente|persona/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('asesor no entra a Configuración', async ({ page }) => {
    test.skip(!asesorPassword, 'E2E_ASESOR_PASSWORD requerido')
    await login(page, asesorEmail, asesorPassword)
    await page.goto('/#/configuracion')
    await expect(page.locator('[data-spec="W-10"]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /configuración|catálogo/i })).toHaveCount(0)
  })

  test('admin ve invitar usuario (W-11) sin completar Auth si rate-limit', async ({ page }) => {
    test.skip(!adminPassword, 'E2E_ADMIN_PASSWORD requerido')
    await login(page, adminEmail, adminPassword)
    await page.goto('/#/usuarios')
    await expect(page.locator('[data-spec="W-11"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /^invitar$/i })).toBeVisible()
    await assertAxeOk(page)
  })
})
