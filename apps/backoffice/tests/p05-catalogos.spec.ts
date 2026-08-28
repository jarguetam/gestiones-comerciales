/**
 * P-05 — E2E de catálogos globales en modo demo (sin backend).
 */
import { expect, test } from '@playwright/test'

test.describe('P-05 catálogos globales (modo demo)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^catálogos$/i }).first().click()
    await expect(page.getByText(/P-05/i)).toBeVisible()
  })

  test('el menú incluye Catálogos y muestra P-05', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /catálogos globales/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^geografía$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^módulos$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^plantillas$/i })).toBeVisible()
  })

  test('geografía permite agregar un departamento en demo', async ({ page }) => {
    await page.getByPlaceholder(/nuevo departamento/i).fill('Sololá')
    await page.getByRole('button', { name: /^agregar$/i }).first().click()
    await expect(page.getByText('Departamento creado')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sololá' })).toBeVisible()
    await page.getByPlaceholder(/renombrar departamento/i).fill('Sololá Norte')
    await page.getByRole('button', { name: /^renombrar$/i }).first().click()
    await expect(page.getByText('Departamento actualizado')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sololá Norte' })).toBeVisible()
  })

  test('geografía importa CSV de municipios en demo', async ({ page }) => {
    await page.locator('textarea').fill('departamento,municipio\nPetén,Flores')
    await page.getByRole('button', { name: /^importar$/i }).click()
    await expect(page.getByText(/importadas 1 filas/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Petén' })).toBeVisible()
  })

  test('módulos lista el núcleo y permite alta demo', async ({ page }) => {
    await page.getByRole('button', { name: /^módulos$/i }).click()
    await expect(page.getByText('core')).toBeVisible()
    await page.getByPlaceholder(/código/i).fill('demo_mod')
    await page.getByPlaceholder(/nombre visible/i).fill('Módulo demo')
    await page.getByRole('button', { name: /^guardar$/i }).click()
    await expect(page.getByText('Módulo guardado')).toBeVisible()
    await expect(page.getByText('demo_mod')).toBeVisible()
  })

  test('plantillas filtra por rubro y crea una actividad', async ({ page }) => {
    await page.getByRole('button', { name: /^plantillas$/i }).click()
    await expect(page.getByRole('button', { name: /verificación de garantías/i })).toBeVisible()
    await page.getByRole('button', { name: /^farmacéutica$/i }).click()
    await expect(page.getByRole('button', { name: /visita médica/i })).toBeVisible()
    await page.getByPlaceholder(/^nombre$/i).fill('Capacitación médica')
    await page.getByPlaceholder(/subactividades/i).fill('Taller\nSeguimiento')
    await page.getByRole('button', { name: /^crear$/i }).click()
    await expect(page.getByText('Plantilla creada')).toBeVisible()
    await expect(page.getByRole('button', { name: /capacitación médica/i })).toBeVisible()
  })
})
