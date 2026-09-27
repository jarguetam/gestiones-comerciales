import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  resolveCampoAccess,
  solicitarPermisosCampo,
  TEXTO_PERMISO_UBICACION,
} from '../src/services/permisosCampo.ts'

test('resolveCampoAccess es ok solo con permiso granted', async () => {
  assert.equal(await resolveCampoAccess(async () => ({ status: 'granted', canAskAgain: true })), 'ok')
  assert.equal(await resolveCampoAccess(async () => ({ status: 'denied', canAskAgain: false })), 'blocked_location')
  assert.equal(await resolveCampoAccess(async () => ({ status: 'undetermined', canAskAgain: true })), 'blocked_location')
})

test('el permiso en segundo plano se pide solo después del primer plano', async () => {
  const llamadas: string[] = []
  const resultado = await solicitarPermisosCampo(
    async () => { llamadas.push('primer plano'); return { status: 'granted' } },
    async () => { llamadas.push('segundo plano'); return { status: 'granted' } },
  )
  assert.equal(resultado, 'ok')
  assert.deepEqual(llamadas, ['primer plano', 'segundo plano'])
})

test('si se deniega el primer plano no se pide ubicación en segundo plano', async () => {
  let segundoPlanoPedido = false
  const resultado = await solicitarPermisosCampo(
    async () => ({ status: 'denied' }),
    async () => { segundoPlanoPedido = true; return { status: 'granted' } },
  )
  assert.equal(resultado, 'blocked_location')
  assert.equal(segundoPlanoPedido, false)
})

test('si se deniega el segundo plano no se declara activo el rastreo', async () => {
  const resultado = await solicitarPermisosCampo(
    async () => ({ status: 'granted' }),
    async () => ({ status: 'denied' }),
  )
  assert.equal(resultado, 'blocked_background')
})

test('sin rastreo configurado solo se pide primer plano para el check-in', async () => {
  const resultado = await solicitarPermisosCampo(async () => ({ status: 'granted' }))
  assert.equal(resultado, 'ok')
})

test('el aviso explica ubicación en segundo plano, finalidad y acceso de la empresa', () => {
  assert.match(TEXTO_PERMISO_UBICACION, /Gestiones Comerciales/)
  assert.match(TEXTO_PERMISO_UBICACION, /ubicación/)
  assert.match(TEXTO_PERMISO_UBICACION, /segundo plano/)
  assert.match(TEXTO_PERMISO_UBICACION, /recorrido de campo/)
  assert.match(TEXTO_PERMISO_UBICACION, /empresa.*consultar/)
})

test('rastreoServicio no usa setInterval como scheduler', () => {
  const src = readFileSync(new URL('../src/services/rastreoServicio.ts', import.meta.url), 'utf8')
  assert.equal(src.includes('setInterval'), false)
  assert.match(src, /TaskManager\.defineTask/)
  assert.match(src, /startLocationUpdatesAsync/)
  assert.match(src, /Gestiones Comerciales está registrando la ruta/)
})
