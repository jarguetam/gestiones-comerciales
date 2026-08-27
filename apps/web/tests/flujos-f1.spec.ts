/**
 * F1.12 — E2E de los flujos núcleo del MVP web (Playwright, modo demo).
 * Corre contra el preview estático (DEMO_MODE) sin backend: valida que
 * los flujos de UI de F1 (W-03 visitas, W-04 personas) existen y operan.
 *
 * Uso: pnpm --filter @gc/web exec playwright test
 * (requiere `npx playwright install chromium` la primera vez)
 */
import { expect, test } from '@playwright/test'

test.describe('F1 MVP web (modo demo)', () => {
  test('la app carga y muestra la navegación principal', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/gestiones/i)
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /nueva visita/i }).first()).toBeVisible()
  })

  test('W-03: el modal de nueva visita ofrece Cliente desde la cartera o alta inline', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /nueva visita/i }).first().click()
    await expect(page.getByText(/cliente/i).first()).toBeVisible()
    await expect(page.getByText(/nuevo cliente/i).first()).toBeVisible()
  })

  test('W-03: alta inline valida nombre requerido', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /nueva visita/i }).first().click()
    await page.getByText(/nuevo cliente/i).first().click()
    await page.getByRole('button', { name: /registrar/i }).first().click()
    await expect(page.getByText(/nombre.*requerido|requerido/i).first()).toBeVisible()
  })

  test('W-04: la pantalla de personas lista la cartera y permite buscar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /personas/i }).first().click()
    await expect(page.getByPlaceholder(/buscar/i).first()).toBeVisible()
    await expect(page.getByText(/registros/i).first()).toBeVisible()
  })

  test('W-06..W-09: en demo se muestran los módulos de rubro', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /^solicitudes$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^depósitos$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^cuentas$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^kilometraje$/i }).first()).toBeVisible()
    await page.getByRole('link', { name: /^solicitudes$/i }).first().click()
    await expect(page.getByText(/W-06/i).first()).toBeVisible()
    await page.getByRole('link', { name: /^depósitos$/i }).first().click()
    await expect(page.getByText(/W-07/i).first()).toBeVisible()
    await page.getByRole('link', { name: /^cuentas$/i }).first().click()
    await expect(page.getByText(/W-08/i).first()).toBeVisible()
    await page.getByRole('link', { name: /^kilometraje$/i }).first().click()
    await expect(page.getByText(/W-09/i).first()).toBeVisible()
  })
})
