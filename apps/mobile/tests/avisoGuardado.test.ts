import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  avisoAgendaGuardada,
  avisoCarteraGuardada,
  avisoCatalogosGuardados,
  cuandoGuardado,
} from '../src/lib/avisoGuardado.ts'

// Fechas en hora local: el resultado no depende de la zona horaria de quien corre la prueba.
const AHORA = new Date(2026, 10, 14, 8, 0)
const iso = (...p: [number, number, number, number, number]) => new Date(...p).toISOString()

test('mismo día: solo la hora', () => {
  assert.equal(cuandoGuardado(iso(2026, 10, 14, 7, 5), AHORA), 'a las 07:05')
})

test('otro día: fecha y hora (lo de anoche no parece de hoy)', () => {
  assert.equal(cuandoGuardado(iso(2026, 10, 13, 17, 30), AHORA), 'el 13/11 a las 17:30')
  assert.equal(cuandoGuardado(iso(2026, 0, 2, 9, 0), AHORA), 'el 02/01 a las 09:00')
})

test('fecha vacía o inválida no deja texto colgando', () => {
  assert.equal(cuandoGuardado('', AHORA), '')
  assert.equal(cuandoGuardado(null, AHORA), '')
  assert.equal(cuandoGuardado(undefined, AHORA), '')
  assert.equal(cuandoGuardado('no-es-fecha', AHORA), '')
})

test('aviso de agenda: actualizando, sin conexión y tras un error', () => {
  const g = iso(2026, 10, 13, 17, 30)
  assert.equal(avisoAgendaGuardada('actualizando', g, AHORA), 'Agenda guardada el 13/11 a las 17:30 · actualizando…')
  assert.equal(avisoAgendaGuardada('sin_conexion', g, AHORA), 'Sin conexión · agenda guardada el 13/11 a las 17:30')
  assert.equal(avisoAgendaGuardada('error', g, AHORA), 'Agenda guardada el 13/11 a las 17:30')
  assert.equal(avisoAgendaGuardada('sin_conexion', null, AHORA), 'Sin conexión · agenda guardada')
  assert.equal(avisoAgendaGuardada('actualizando', '', AHORA), 'Agenda guardada · actualizando…')
})

test('avisos de catálogos y cartera guardados', () => {
  const g = iso(2026, 10, 14, 6, 45)
  assert.equal(avisoCatalogosGuardados(g, AHORA), 'Catálogos guardados a las 06:45')
  assert.equal(avisoCatalogosGuardados('', AHORA), 'Catálogos guardados en el teléfono')
  assert.equal(avisoCarteraGuardada(g, AHORA), 'Sin conexión · clientes guardados a las 06:45')
  assert.equal(avisoCarteraGuardada(undefined, AHORA), 'Sin conexión · clientes guardados en el teléfono')
})
