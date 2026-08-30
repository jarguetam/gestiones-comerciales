/**
 * axe-core sobre login. CI falla solo en critical/serious.
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function assertSinViolacionesGraves(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const graves = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(graves, graves.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n')).toEqual([])
}

test.describe('accesibilidad (axe graves)', () => {
  test('login', async ({ page }) => {
    await page.goto('/#/login')
    await expect(page.locator('[data-spec="W-01"]')).toBeVisible()
    await assertSinViolacionesGraves(page)
  })
})
