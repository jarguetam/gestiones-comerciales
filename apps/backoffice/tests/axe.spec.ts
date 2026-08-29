/**
 * axe-core sobre login y 3 pantallas demo del backoffice.
 * CI falla solo en violaciones critical/serious.
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function assertSinViolacionesGraves(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const graves = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(graves, graves.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n')).toEqual([])
}

test.describe('accesibilidad backoffice (axe graves)', () => {
  test('login', async ({ page }) => {
    await page.goto('/#/login')
    await expect(page.locator('[data-spec="P-01"]')).toBeVisible()
    await assertSinViolacionesGraves(page)
  })

  test('empresas demo', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /empresas/i }).first()).toBeVisible()
    await assertSinViolacionesGraves(page)
  })

  test('catálogos demo', async ({ page }) => {
    await page.goto('/#/catalogos')
    await expect(page.locator('[data-spec="P-05"]')).toBeVisible()
    await assertSinViolacionesGraves(page)
  })

  test('salud demo', async ({ page }) => {
    await page.goto('/#/salud')
    await expect(page.locator('[data-spec="P-06"]')).toBeVisible()
    await assertSinViolacionesGraves(page)
  })
})
