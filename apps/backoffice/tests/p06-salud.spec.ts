import { expect, test } from '@playwright/test'

test.describe('P-06 salud (sin demo)', () => {
  test('sin sesión no abre salud', async ({ page }) => {
    await page.goto('/#/salud')
    await expect(page.locator('[data-spec="P-01"]')).toBeVisible()
    await expect(page.locator('[data-spec="P-06"]')).toHaveCount(0)
  })
})
