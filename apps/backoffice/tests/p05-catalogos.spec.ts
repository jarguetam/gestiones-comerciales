import { expect, test } from '@playwright/test'

test.describe('P-05 catálogos (sin demo)', () => {
  test('sin sesión no abre catálogos', async ({ page }) => {
    await page.goto('/#/catalogos')
    await expect(page.locator('[data-spec="P-01"]')).toBeVisible()
    await expect(page.locator('[data-spec="P-05"]')).toHaveCount(0)
  })
})
