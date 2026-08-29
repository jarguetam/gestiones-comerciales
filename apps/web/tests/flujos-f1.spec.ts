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
    await expect(page.getByRole('link', { name: /^formularios$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^mapa$/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /nueva visita/i }).first()).toBeVisible()
  })

  test('W-03: el modal de nueva visita ofrece Cliente desde la cartera o alta inline', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /nueva visita/i }).first().click()
    await expect(page.getByText(/cliente \*/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /nuevo cliente/i })).toBeVisible()
  })

  test('W-03: alta inline valida nombre requerido', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('banner').getByRole('button', { name: /nueva visita/i }).click()
    await expect(page.getByRole('heading', { name: /nueva visita/i })).toBeVisible()
    await page.getByRole('button', { name: /nuevo cliente/i }).click()
    await page.getByRole('button', { name: /registrar y usar/i }).click()
    await expect(page.getByText(/nombre es requerido/i).first()).toBeVisible()
  })

  test('W-03: filtros de estado quedan en la URL', async ({ page }) => {
    await page.goto('/#/visitas')
    await expect(page.locator('[data-spec="W-03"]').first()).toBeVisible()
    await page.getByLabel(/^estado$/i).selectOption('completada')
    await expect(page).toHaveURL(/estado=completada/)
    await expect(page.getByLabel(/^estado$/i)).toHaveValue('completada')
  })

  test('W-04: la pantalla de personas lista la cartera y permite buscar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /personas/i }).first().click()
    await expect(page.getByPlaceholder(/buscar/i).first()).toBeVisible()
    await expect(page.getByText(/registros/i).first()).toBeVisible()
  })

  test('W-04: importar CSV agrega personas a la cartera (demo)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /personas/i }).first().click()
    await expect(page.getByRole('button', { name: /importar csv/i })).toBeVisible()
    const csv = 'nombre,documento,categoria,telefono,direccion\nCliente CSV Importado,NIT-CSV-1,Cliente,+502 1111-2222,Zona 1\n'
    await page.getByLabel(/archivo csv de personas/i).setInputFiles({
      name: 'cartera.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    await expect(page.getByText(/cliente csv importado/i).first()).toBeVisible()
    await expect(page.getByText(/importación demo/i).first()).toBeVisible()
  })

  test('W-05: renderer dinámico, score en vivo y envío demo', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^formularios$/i }).first().click()
    await expect(page.locator('[data-spec="W-05"]').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /ficha de cultivo/i }).first()).toBeVisible()
    await page.getByLabel(/^cultivo/i).fill('Maíz')
    await page.getByLabel(/hectáreas sembradas/i).fill('3.5')
    await page.getByLabel(/estado fenológico/i).selectOption('Cosecha')
    await expect(page.getByText(/score \d+%/i).first()).toBeVisible()
    await page.getByRole('button', { name: /enviar formulario/i }).click()
    await expect(page.getByRole('status').filter({ hasText: /envío demo|enviado/i })).toBeVisible()
    await expect(page.getByText(/maíz/i).first()).toBeVisible()
  })

  test('W-06..W-09: en demo se muestran los módulos de rubro', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /^solicitudes$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^depósitos$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^cuentas$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^kilometraje$/i }).first()).toBeVisible()
    await page.getByRole('link', { name: /^solicitudes$/i }).first().click()
    await expect(page.locator('[data-spec="W-06"]').first()).toBeVisible()
    await page.getByRole('link', { name: /^depósitos$/i }).first().click()
    await expect(page.locator('[data-spec="W-07"]').first()).toBeVisible()
    await page.getByRole('link', { name: /^cuentas$/i }).first().click()
    await expect(page.locator('[data-spec="W-08"]').first()).toBeVisible()
    await page.getByRole('link', { name: /^kilometraje$/i }).first().click()
    await expect(page.locator('[data-spec="W-09"]').first()).toBeVisible()
  })

  test('W-14: mapa muestra última posición, recorrido y filtro de equipo', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^mapa$/i }).first().click()
    await expect(page.locator('[data-spec="W-14"]').first()).toBeVisible()
    await expect(page.getByRole('application', { name: /mapa de asesores/i })).toBeVisible()
    await expect(page.getByText(/luisa asesora/i).first()).toBeVisible()
    await expect(page.getByText(/ana asesora/i).first()).toBeVisible()
    await page.getByLabel(/^equipo$/i).selectOption({ label: 'Erick Supervisor' })
    await expect(page.getByText(/luisa asesora/i).first()).toBeVisible()
    await expect(page.getByText(/ana asesora/i)).toHaveCount(0)
    await page.getByRole('cell', { name: /luisa asesora/i }).click()
    await expect(page.getByText(/puntos/i).first()).toBeVisible()
  })

  test('W-02b: tablero gerencial con drill-down y ranking', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-spec="W-02b"]').first()).toBeVisible()
    await expect(page.getByLabel(/filtrar por supervisor/i)).toBeVisible()
    await expect(page.getByText(/ranking de equipos/i).first()).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: /erick supervisor/i })).toBeVisible()
    await page.getByLabel(/filtrar por supervisor/i).selectOption({ label: 'Erick Supervisor' })
  })

  test('W-12: auditoría lista visita y persona', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^auditoría$/i }).first().click()
    await expect(page.locator('[data-spec="W-12"]').first()).toBeVisible()
    await expect(page.getByRole('cell', { name: /^visita$/i }).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: /^persona$/i }).first()).toBeVisible()
  })

  test('W-13: notificaciones con marcar leída', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^notificaciones$/i }).first().click()
    await expect(page.locator('[data-spec="W-13"]').first()).toBeVisible()
    await page.getByRole('button', { name: /marcar leída/i }).first().click()
    await expect(page.getByRole('button', { name: /marcar leída/i })).toHaveCount(1)
  })

  test('W-10 y W-11: configuración y usuarios están en la navegación', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /configuración/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^usuarios$/i }).first()).toBeVisible()
    await page.getByRole('link', { name: /configuración/i }).first().click()
    await expect(page.locator('[data-spec="W-10"]').first()).toBeVisible()
    await page.getByRole('link', { name: /^usuarios$/i }).first().click()
    await expect(page.locator('[data-spec="W-11"]').first()).toBeVisible()
  })
})
