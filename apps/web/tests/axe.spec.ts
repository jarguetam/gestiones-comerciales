/**
 * axe-core sobre rutas públicas del PR (sin sesión).
 * Rutas autenticadas se cubren en e2e-staging (Task 7).
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const RUTAS_PUBLICAS = [
  { hash: '/#/login', spec: 'W-01' },
  { hash: '/#/recuperar', spec: null },
] as const

const RUTAS_AUTH = [
  '/',
  '/visitas',
  '/personas',
  '/crm',
  '/formularios',
  '/mapa',
  '/solicitudes',
  '/depositos',
  '/cuentas',
  '/kilometraje',
  '/notificaciones',
  '/auditoria',
  '/configuracion',
  '/usuarios',
] as const

async function assertSinViolacionesGraves(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const graves = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  expect(graves, graves.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n')).toEqual([])
}

test.describe('accesibilidad (axe graves)', () => {
  for (const ruta of RUTAS_PUBLICAS) {
    test(ruta.hash, async ({ page }) => {
      await page.goto(ruta.hash)
      if (ruta.spec) await expect(page.locator(`[data-spec="${ruta.spec}"]`)).toBeVisible()
      else await expect(page.getByRole('heading', { name: /recuperar contraseña/i })).toBeVisible()
      await assertSinViolacionesGraves(page)
    })
  }

  for (const path of RUTAS_AUTH) {
    test(`sin sesión ${path} redirige a login axe-clean`, async ({ page }) => {
      await page.goto(`/#${path === '/' ? '' : path}`)
      await expect(page.locator('[data-spec="W-01"]')).toBeVisible()
      await assertSinViolacionesGraves(page)
    })
  }
})
