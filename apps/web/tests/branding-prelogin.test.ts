import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  brandingPreLogin,
  slugTenantDeUrl,
  leerBrandingCache,
  claveCodigo,
  LS_BRANDING_ULTIMO,
} from '../src/lib/brandingPreLogin.ts'
import { BRANDING_DEMO } from '../src/lib/branding.ts'

test('slugTenantDeUrl lee query de search y de hash', () => {
  assert.equal(slugTenantDeUrl('?tenant=AgroMoney', ''), 'agromoney')
  assert.equal(slugTenantDeUrl('', '#/login?tenant=demo'), 'demo')
  assert.equal(slugTenantDeUrl('', '#/login'), null)
})

test('brandingPreLogin usa DEMO si no hay cache', () => {
  const mem = { getItem: () => null }
  const b = brandingPreLogin({
    demo: true,
    host: 'app.local',
    search: '',
    hash: '#/login',
    storage: mem,
  })
  assert.equal(b.nombre_comercial, BRANDING_DEMO.nombre_comercial)
})

test('brandingPreLogin prioriza cache por codigo de ?tenant=', () => {
  const branding = { nombre_comercial: 'Farmacia Demo', color_primario: '#0F766E' }
  const mem: Pick<Storage, 'getItem'> = {
    getItem: (k: string) => (k === claveCodigo('farmacia') ? JSON.stringify(branding) : null),
  }
  const b = brandingPreLogin({
    demo: true,
    host: 'localhost',
    search: '?tenant=farmacia',
    hash: '#/login',
    storage: mem,
  })
  assert.equal(b.nombre_comercial, 'Farmacia Demo')
})

test('leerBrandingCache cae a ultimo si no hay host', () => {
  const mem: Pick<Storage, 'getItem'> = {
    getItem: (k: string) => (k === LS_BRANDING_ULTIMO ? JSON.stringify({ nombre_comercial: 'Último' }) : null),
  }
  const b = leerBrandingCache({ host: 'x.example', storage: mem })
  assert.equal(b?.nombre_comercial, 'Último')
})
