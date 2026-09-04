import { expect, type Page } from '@playwright/test'

const email = () => process.env.E2E_ADMIN_EMAIL ?? process.env.E2E_ASESOR_EMAIL ?? ''
const password = () => process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_ASESOR_PASSWORD ?? ''
const mfaCode = () => process.env.E2E_MFA_CODE ?? ''

export function credencialesAuthDisponibles(): boolean {
  return Boolean(email() && password())
}

export function emailAuth(): string {
  return email()
}

/**
 * Login empresa. Si aparece MFA y hay E2E_MFA_CODE, lo completa.
 * Si aparece MFA sin código, lanza error claro para el agente/CI.
 */
export async function loginQa(page: Page): Promise<void> {
  const user = email()
  const pass = password()
  if (!user || !pass) throw new Error('E2E_ADMIN_EMAIL/PASSWORD (o ASESOR) requeridos')

  await page.goto('#/login')
  await expect(page.locator('[data-spec="W-01"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /entrar al tablero/i })).toHaveCount(0)

  await page.getByLabel(/^email$/i).fill(user)
  await page.getByLabel(/^contraseña$/i).fill(pass)
  await page.getByRole('button', { name: /^ingresar$/i }).click()

  const totp = page.getByLabel(/código mfa/i)
  const nav = page.getByRole('link', { name: /dashboard|hoy|jornada|visitas/i }).first()

  const kind = await Promise.race([
    totp.waitFor({ state: 'visible', timeout: 25_000 }).then(() => 'mfa' as const),
    nav.waitFor({ state: 'visible', timeout: 25_000 }).then(() => 'ok' as const),
  ])

  if (kind === 'ok') return

  const code = mfaCode()
  if (!code) {
    throw new Error('GC-QA-MFA: se pide Código MFA; definí E2E_MFA_CODE')
  }
  await totp.fill(code)
  await page.getByRole('button', { name: /^verificar$/i }).click()

  // Fallar rápido si el TOTP es inválido/expirado
  const alert = page.getByRole('alert')
  await Promise.race([
    nav.waitFor({ state: 'visible', timeout: 25_000 }),
    alert.waitFor({ state: 'visible', timeout: 25_000 }).then(async () => {
      const msg = ((await alert.textContent()) ?? '').trim()
      if (/invalid|inválid|totp|mfa|código/i.test(msg)) {
        throw new Error(`GC-QA-MFA-INVALID: ${msg || 'código MFA rechazado'}`)
      }
      throw new Error(`GC-QA-LOGIN: ${msg || 'error tras MFA'}`)
    }),
  ])
}
