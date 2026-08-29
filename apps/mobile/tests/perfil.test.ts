import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { brandingDeJson, nombreComercial } from '../src/lib/branding.ts'
import { modulosDeFilas, perfilDesdeFuentes } from '../src/lib/perfil.ts'

test('arma perfil aunque usuario y tenant no vengan (como la web)', () => {
  const perfil = perfilDesdeFuentes({
    userId: 'u1',
    claims: { tenantId: 't-habitat', rol: 'asesor' },
    email: 'luis.martinez@habitat.com',
  })
  assert.equal(perfil.id, 'u1')
  assert.equal(perfil.tenantId, 't-habitat')
  assert.equal(perfil.rol, 'asesor')
  assert.equal(perfil.nombre, 'luis.martinez')
  assert.equal(perfil.tenantNombre, 'Gestiones Comerciales')
  assert.deepEqual(perfil.modulos, [])
})

test('usa fila usuario + branding del tenant cuando RLS deja leer', () => {
  const branding = brandingDeJson({ nombre_comercial: 'Hábitat SAS', color_primario: '#0F766E' })
  const perfil = perfilDesdeFuentes({
    userId: 'u1',
    claims: { tenantId: 't1', rol: 'asesor' },
    usuario: { id: 'u1', nombre: 'Luis Martínez' },
    tenantNombre: nombreComercial(branding, 'Hábitat'),
    branding,
    modulos: ['crm', 'creditos'],
  })
  assert.equal(perfil.nombre, 'Luis Martínez')
  assert.equal(perfil.tenantNombre, 'Hábitat SAS')
  assert.equal(perfil.branding.color_primario, '#0F766E')
  assert.deepEqual(perfil.modulos, ['crm', 'creditos'])
})

test('modulosDeFilas aplana embed modulo de PostgREST', () => {
  assert.deepEqual(
    modulosDeFilas([
      { modulo: { codigo: 'crm' } },
      { modulo: [{ codigo: 'depositos' }] },
      { modulo: null },
    ]),
    ['crm', 'depositos'],
  )
})
