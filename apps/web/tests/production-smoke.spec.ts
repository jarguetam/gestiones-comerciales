import { expect, test } from '@playwright/test'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL
test.skip(process.env.E2E_SUITE !== 'production', 'Solo se ejecuta contra Pages productivo')

test('Pages publica login web y backoffice con backend configurado', async ({ page }) => {
  if (!baseUrl) throw new Error('PLAYWRIGHT_BASE_URL requerido para smoke de producción')

  for (const [route, spec] of [
    ['', 'W-01'],
    ['backoffice/', 'P-01'],
  ]) {
    await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
    await expect(page.locator(`[data-spec="${spec}"]`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
    await expect(page.getByText('GC-CORE-001')).toHaveCount(0)
  }
})
