import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  inicioDiaLocalISO,
  tarjetasVisibles,
  textoEstado,
  textoValor,
  valorDeConteo,
} from '../src/lib/resumenHoy.ts'

test('tarjetas de módulos inactivos no se muestran', () => {
  assert.deepEqual(tarjetasVisibles([]), ['visitas', 'sync'])
  assert.deepEqual(tarjetasVisibles(['crm', 'solicitudes', 'depositos']), [
    'visitas',
    'leads',
    'solicitudes',
    'depositos',
    'sync',
  ])
  assert.deepEqual(tarjetasVisibles(['depositos']), ['visitas', 'depositos', 'sync'])
})

test('conteo correcto se muestra como número', () => {
  const v = valorDeConteo({ count: 4, error: null })
  assert.deepEqual(v, { estado: 'ok', valor: 4 })
  assert.equal(textoValor(v), '4')
})

test('sin red muestra raya y Sin conexión, nunca 0', () => {
  const v = valorDeConteo({ count: null, error: { message: 'TypeError: Network request failed' } })
  assert.deepEqual(v, { estado: 'sin_conexion' })
  assert.equal(textoValor(v), '—')
  assert.equal(textoEstado(v, '3 abiertos'), 'Sin conexión')
})

test('error de lectura conserva el código GC o cae en GC-CORE-001', () => {
  assert.deepEqual(valorDeConteo({ count: null, error: { message: 'GC-CRM-002: sin permiso' } }), {
    estado: 'error',
    codigo: 'GC-CRM-002',
  })
  const v = valorDeConteo({ count: null, error: { message: 'permission denied for table lead' } })
  assert.deepEqual(v, { estado: 'error', codigo: 'GC-CORE-001' })
  assert.equal(textoEstado(v, 'x'), 'No se pudo leer (GC-CORE-001)')
})

test('respuesta sin count es error, no cero', () => {
  assert.deepEqual(valorDeConteo({ count: null, error: null }), { estado: 'error', codigo: 'GC-CORE-001' })
})

test('inicio del día es medianoche local', () => {
  const iso = inicioDiaLocalISO(new Date(2026, 9, 3, 15, 42))
  const d = new Date(iso)
  assert.equal(d.getHours(), 0)
  assert.equal(d.getMinutes(), 0)
  assert.equal(d.getDate(), 3)
})
