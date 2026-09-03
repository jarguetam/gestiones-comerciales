import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolveCampoAccess } from '../src/services/permisosCampo.ts'

test('resolveCampoAccess es ok solo con permiso granted', async () => {
  assert.equal(await resolveCampoAccess(async () => ({ status: 'granted', canAskAgain: true })), 'ok')
  assert.equal(await resolveCampoAccess(async () => ({ status: 'denied', canAskAgain: false })), 'blocked_location')
  assert.equal(await resolveCampoAccess(async () => ({ status: 'undetermined', canAskAgain: true })), 'blocked_location')
})

test('rastreoServicio no usa setInterval como scheduler', () => {
  const src = readFileSync(new URL('../src/services/rastreoServicio.ts', import.meta.url), 'utf8')
  assert.equal(src.includes('setInterval'), false)
  assert.match(src, /TaskManager\.defineTask/)
  assert.match(src, /startLocationUpdatesAsync/)
  assert.match(src, /Gestiones Comerciales está registrando la ruta/)
})
