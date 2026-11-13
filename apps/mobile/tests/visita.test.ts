import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { LIMITE_PERSONAS_CAMPO } from '../src/lib/catalogosCampo.ts'
import { validarVisitaNueva } from '../src/lib/visita.ts'

const ok = {
  personaNombre: 'Agropecuaria El Triunfo',
  actividadId: 1,
  subActividadId: 11,
  actividadHoraId: 2,
  fecha: '2026-08-29',
  horaInicio: '09:00',
}

test('visita válida no devuelve error', () => {
  assert.equal(validarVisitaNueva(ok), null)
})

test('GC-VIS-001 si faltan actividad o subactividad', () => {
  assert.equal(validarVisitaNueva({ ...ok, actividadId: null }), 'GC-VIS-001: actividad y subactividad requeridas')
  assert.equal(validarVisitaNueva({ ...ok, subActividadId: undefined }), 'GC-VIS-001: actividad y subactividad requeridas')
})

test('oficina y geografía las resuelve el servidor', () => {
  assert.equal(validarVisitaNueva(ok), null)
})

test('el límite de clientes en campo cubre carteras grandes', () => {
  assert.ok(LIMITE_PERSONAS_CAMPO >= 1000)
})

test('GC-VIS-003 si no hay bloque de horas', () => {
  assert.equal(validarVisitaNueva({ ...ok, actividadHoraId: null }), 'GC-VIS-003: catálogo de horas vacío')
})

test('GC-VIS-004 nombre del visitado requerido', () => {
  assert.equal(validarVisitaNueva({ ...ok, personaNombre: '  ' }), 'GC-VIS-004: nombre del visitado requerido')
})

test('GC-VIS-005 y GC-VIS-006 fecha y hora', () => {
  assert.equal(validarVisitaNueva({ ...ok, fecha: '29/08' }), 'GC-VIS-005: fecha requerida (AAAA-MM-DD)')
  assert.equal(validarVisitaNueva({ ...ok, horaInicio: '' }), 'GC-VIS-006: hora de inicio requerida')
})
