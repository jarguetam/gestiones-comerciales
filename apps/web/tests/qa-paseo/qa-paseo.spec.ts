/**
 * Paseo QA pantalla por pantalla. Acumula hallazgos y escribe reporte al final.
 * Modo public: siempre. Modo auth: requiere E2E_*_PASSWORD (+ E2E_MFA_CODE si MFA).
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Recolector, formatearReporteMd, severidadAxe } from './hallazgos.ts'
import { credencialesAuthDisponibles, loginQa } from './login.ts'
import { observarPagina } from './observadores.ts'
import { RUTAS_AUTH, RUTAS_PUBLICAS, hashUrl, type RutaPaseo } from './rutas.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORT_DIR = join(__dirname, '../../test-results')

const globalRec = new Recolector()
const baseUrl = () => process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'

async function assertAxe(page: Page, ruta: string, rec: Recolector) {
  const results = await new AxeBuilder({ page }).analyze()
  for (const v of results.violations) {
    if (v.impact !== 'critical' && v.impact !== 'serious') continue
    rec.add({
      tipo: 'axe',
      severidad: severidadAxe(v.impact),
      ruta,
      mensaje: `${v.id}: ${v.help}`,
      evidencia: v.nodes[0]?.target?.join(' ') ?? '',
    })
  }
}

async function assertNoBlank(page: Page, ruta: string, rec: Recolector) {
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
  if (text.length < 20) {
    rec.add({ tipo: 'blank', severidad: 'high', ruta, mensaje: `body casi vacío (${text.length} chars)` })
  }
}

async function assertSpec(page: Page, ruta: RutaPaseo, rec: Recolector) {
  if (!ruta.spec) {
    if (ruta.path === '/recuperar') {
      const ok = await page
        .getByRole('heading', { name: /recuperar contraseña/i })
        .isVisible()
        .catch(() => false)
      if (!ok) {
        rec.add({ tipo: 'data-spec', severidad: 'high', ruta: ruta.path, mensaje: 'sin heading recuperar' })
      }
    }
    return
  }
  const n = await page.locator(`[data-spec="${ruta.spec}"]`).count()
  if (n === 0) {
    rec.add({
      tipo: 'data-spec',
      severidad: 'high',
      ruta: ruta.path,
      mensaje: `falta data-spec=${ruta.spec}`,
    })
  }
}

async function smokeControles(page: Page, ruta: string, rec: Recolector) {
  const controls = page.locator(
    'main a, main button, nav a, nav button, [role="navigation"] a, [role="navigation"] button',
  )
  const count = await controls.count()
  const limit = Math.min(count, 40)
  for (let i = 0; i < limit; i++) {
    const el = controls.nth(i)
    if (!(await el.isVisible().catch(() => false))) continue
    const name =
      (await el.getAttribute('aria-label'))?.trim() ||
      (await el.innerText().catch(() => '')).replace(/\s+/g, ' ').trim() ||
      (await el.getAttribute('title'))?.trim() ||
      ''
    if (!name) {
      rec.add({
        tipo: 'control',
        severidad: 'medium',
        ruta,
        mensaje: 'control visible sin nombre accesible',
        evidencia: await el.evaluate((n) => n.outerHTML.slice(0, 180)).catch(() => `nth=${i}`),
      })
    }
  }
}

async function visitar(page: Page, ruta: RutaPaseo, rec: Recolector, expectLoginRedirect: boolean) {
  const detach = observarPagina(page, ruta.path, rec)
  try {
    await page.goto(hashUrl(ruta.path), { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)

    if (expectLoginRedirect) {
      const onLogin = await page.locator('[data-spec="W-01"]').isVisible().catch(() => false)
      if (!onLogin) {
        rec.add({
          tipo: 'redirect',
          severidad: 'high',
          ruta: ruta.path,
          mensaje: 'sin sesión no redirigió a login W-01',
        })
      } else {
        await assertAxe(page, ruta.path, rec)
      }
      return
    }

    const stuckLogin = await page.locator('[data-spec="W-01"]').isVisible().catch(() => false)
    if (stuckLogin && ruta.modo === 'auth') {
      rec.add({
        tipo: 'redirect',
        severidad: 'critical',
        ruta: ruta.path,
        mensaje: 'sesión perdida: volvió a login',
      })
      return
    }

    await assertNoBlank(page, ruta.path, rec)
    await assertSpec(page, ruta, rec)
    await assertAxe(page, ruta.path, rec)
    await smokeControles(page, ruta.path, rec)
  } catch (e) {
    rec.add({
      tipo: 'crash',
      severidad: 'critical',
      ruta: ruta.path,
      mensaje: e instanceof Error ? e.message : String(e),
    })
  } finally {
    detach()
  }
}

function volcarReporte(modo: 'public' | 'auth') {
  mkdirSync(REPORT_DIR, { recursive: true })
  const hallazgos = globalRec.todos()
  const payload = {
    baseUrl: baseUrl(),
    modo,
    generadoEn: new Date().toISOString(),
    hallazgos,
  }
  writeFileSync(join(REPORT_DIR, 'qa-paseo-report.json'), JSON.stringify(payload, null, 2))
  writeFileSync(join(REPORT_DIR, 'qa-paseo-report.md'), formatearReporteMd(payload))
}

test.describe('qa-paseo public', () => {
  test.afterAll(() => {
    volcarReporte('public')
  })

  for (const ruta of RUTAS_PUBLICAS) {
    test(`public ${ruta.path} (${ruta.titulo})`, async ({ page }) => {
      const rec = new Recolector()
      await visitar(page, ruta, rec, false)
      if (ruta.path === '/login') {
        await expect(page.locator('[data-spec="W-01"]')).toBeVisible()
      }
      globalRec.merge(rec)
      const graves = rec.todos().filter((h) => h.severidad === 'critical' || h.severidad === 'high')
      expect(graves, graves.map((h) => `${h.tipo}: ${h.mensaje}`).join('\n')).toEqual([])
    })
  }

  for (const ruta of RUTAS_AUTH) {
    test(`sin sesión ${ruta.path} → login`, async ({ page }) => {
      const rec = new Recolector()
      await visitar(page, ruta, rec, true)
      globalRec.merge(rec)
      const graves = rec.todos().filter((h) => h.severidad === 'critical' || h.severidad === 'high')
      expect(graves, graves.map((h) => `${h.tipo}: ${h.mensaje}`).join('\n')).toEqual([])
    })
  }
})

test.describe('qa-paseo auth', () => {
  test.beforeAll(() => {
    test.skip(!credencialesAuthDisponibles(), 'E2E_ADMIN_PASSWORD (o ASESOR) requerido')
  })

  test.afterAll(() => {
    if (credencialesAuthDisponibles()) volcarReporte('auth')
  })

  test('login y paseo de pantallas', async ({ page }) => {
    test.skip(!credencialesAuthDisponibles(), 'credenciales requeridas')
    await loginQa(page)

    for (const ruta of RUTAS_AUTH) {
      const rec = new Recolector()
      await visitar(page, ruta, rec, false)
      globalRec.merge(rec)
    }

    const graves = globalRec.todos().filter((h) => h.severidad === 'critical' || h.severidad === 'high')
    expect(
      graves,
      graves.map((h) => `[${h.ruta}] ${h.tipo}: ${h.mensaje}`).join('\n') || 'ok',
    ).toEqual([])
  })
})
