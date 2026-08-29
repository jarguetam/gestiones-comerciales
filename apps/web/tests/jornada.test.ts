import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { etiquetaLugar, fechaJornada, formatearFechaJornada, progresoJornada, visitasDelDia } from '../src/lib/jornada.ts'

test('progresoJornada cuenta completadas y aprobadas', () => {
  const p = progresoJornada([
    { estado: 'programada' },
    { estado: 'completada' },
    { estado: 'aprobada' },
    { estado: 'anulada' },
  ])
  assert.equal(p.total, 4)
  assert.equal(p.hechas, 2)
  assert.equal(p.pct, 50)
})

test('progresoJornada vacío es 0%', () => {
  assert.deepEqual(progresoJornada([]), { total: 0, hechas: 0, pct: 0 })
})

test('fechaJornada prefiere hoy si hay visitas', () => {
  assert.equal(
    fechaJornada(
      [
        { date: '2026-09-17' },
        { date: '2026-08-29' },
      ],
      '2026-08-29',
    ),
    '2026-08-29',
  )
  assert.equal(fechaJornada([{ date: '2026-09-17' }], '2026-08-29'), '2026-09-17')
})

test('visitasDelDia filtra por ISO', () => {
  const del = visitasDelDia(
    [
      { date: '2026-09-17', title: 'A' },
      { date: '2026-09-18', title: 'B' },
    ],
    '2026-09-17',
  )
  assert.equal(del.length, 1)
  assert.equal(del[0]?.title, 'A')
})

test('formatearFechaJornada es display en español', () => {
  const t = formatearFechaJornada('2026-09-17')
  assert.match(t, /septiembre/i)
  assert.match(t, /17/)
})

test('etiquetaLugar usa zona, luego location', () => {
  assert.equal(etiquetaLugar({ zonaNombre: 'Escuintla' }), 'Escuintla')
  assert.equal(etiquetaLugar({ location: 'Km 56' }), 'Km 56')
  assert.equal(etiquetaLugar({}), 'Sin zona')
})
