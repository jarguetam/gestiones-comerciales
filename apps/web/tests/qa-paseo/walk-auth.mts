/**
 * Paseo auth local: login + MFA (/tmp/gc-mfa.code o E2E_MFA_CODE) + recorrido de rutas.
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { Recolector, formatearReporteMd, severidadAxe } from './hallazgos.ts'
import { RUTAS_AUTH, hashUrl, selectorSpecs } from './rutas.ts'

const MFA_FILE = '/tmp/gc-mfa.code'
const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '')
const email = process.env.E2E_ADMIN_EMAIL ?? ''
const password = process.env.E2E_ADMIN_PASSWORD ?? ''
const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORT_DIR = join(__dirname, '../../test-results')

function absHash(path: string): string {
  return `${baseURL}/${hashUrl(path)}`
}

async function waitMfa(timeoutMs = 900_000): Promise<string> {
  if (existsSync(MFA_FILE)) unlinkSync(MFA_FILE)
  delete process.env.E2E_MFA_CODE
  const start = Date.now()
  console.log(`Esperando MFA en ${MFA_FILE}…`)
  while (Date.now() - start < timeoutMs) {
    if (existsSync(MFA_FILE)) {
      const code = readFileSync(MFA_FILE, 'utf8').trim()
      if (/^\d{6}$/.test(code)) {
        unlinkSync(MFA_FILE)
        return code
      }
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('timeout esperando MFA')
}

async function main() {
  if (!email || !password) throw new Error('E2E_ADMIN_EMAIL/PASSWORD requeridos')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const rec = new Recolector()
  let rutaActual = '/login'

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/Content Security Policy|fonts\.googleapis|Failed to load resource|frame-ancestors/i.test(text)) return
    rec.add({ tipo: 'console', severidad: 'high', ruta: rutaActual, mensaje: text.slice(0, 400) })
  })
  page.on('pageerror', (err) => {
    rec.add({ tipo: 'crash', severidad: 'critical', ruta: rutaActual, mensaje: err.message.slice(0, 400) })
  })

  await page.goto(absHash('/login'), { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/^contraseña$/i).fill(password)
  await page.getByRole('button', { name: /^ingresar$/i }).click()
  await page.getByLabel(/código mfa/i).waitFor({ state: 'visible', timeout: 30_000 })

  const preset = process.env.E2E_MFA_CODE?.trim()
  const code = preset && /^\d{6}$/.test(preset) ? preset : await waitMfa()
  console.log('MFA recibido, verificando…')
  await page.getByLabel(/código mfa/i).fill(code)
  await page.getByRole('button', { name: /^verificar$/i }).click()
  await page.getByRole('link', { name: /dashboard|hoy|jornada|visitas/i }).first().waitFor({
    state: 'visible',
    timeout: 30_000,
  })
  console.log('Login OK, recorriendo…')

  for (const ruta of RUTAS_AUTH) {
    rutaActual = ruta.path
    await page.goto(absHash(ruta.path), { waitUntil: 'domcontentloaded' })
    await page.getByText(/^Cargando/).waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
    if (ruta.specs?.length) {
      const ok = await page
        .locator(selectorSpecs(ruta.specs))
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false)
      if (!ok) {
        rec.add({
          tipo: 'data-spec',
          severidad: 'high',
          ruta: ruta.path,
          mensaje: `falta data-spec=${ruta.specs.join('|')}`,
        })
      }
    }
    const axe = await new AxeBuilder({ page }).analyze()
    for (const v of axe.violations) {
      if (v.impact !== 'critical' && v.impact !== 'serious') continue
      rec.add({
        tipo: 'axe',
        severidad: severidadAxe(v.impact),
        ruta: ruta.path,
        mensaje: `${v.id}: ${v.help}`,
      })
    }
    console.log(`  ${ruta.path}`)
  }

  mkdirSync(REPORT_DIR, { recursive: true })
  const payload = {
    baseUrl: baseURL,
    modo: 'auth' as const,
    generadoEn: new Date().toISOString(),
    hallazgos: rec.todos(),
  }
  writeFileSync(join(REPORT_DIR, 'qa-paseo-report.json'), JSON.stringify(payload, null, 2))
  writeFileSync(join(REPORT_DIR, 'qa-paseo-report.md'), formatearReporteMd(payload))
  console.log(`Hallazgos: ${payload.hallazgos.length}`)
  for (const h of payload.hallazgos) {
    console.log(`- [${h.severidad}] ${h.tipo} ${h.ruta}: ${h.mensaje.slice(0, 160)}`)
  }
  await browser.close()
  process.exit(payload.hallazgos.some((h) => h.severidad === 'critical' || h.severidad === 'high') ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
