import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  filasDelEquipo,
  kpisDeFilas,
  rankingSupervisores,
  porcentajeCompletadas,
  demoFilasDashboard,
  specIdsDashboard,
  type FilaDashboard,
} from '../src/features/dashboard/dashboard.ts'

function fila(parcial: Partial<FilaDashboard>): FilaDashboard {
  return {
    usuario_id: 'u',
    nombre: 'X',
    rol: 'asesor',
    jefe_id: null,
    visitas_programadas: 0,
    visitas_completadas: 0,
    visitas_aprobadas: 0,
    visitas_rechazadas: 0,
    ...parcial,
  }
}

test('filasDelEquipo deja todo si no hay supervisor seleccionado', () => {
  const filas = demoFilasDashboard()
  assert.equal(filasDelEquipo(filas, null).length, filas.length)
})

test('filasDelEquipo recorta al supervisor y sus asesores', () => {
  const filas = [
    fila({ usuario_id: 'g1', nombre: 'Gerente', rol: 'gerente' }),
    fila({ usuario_id: 's1', nombre: 'Erick', rol: 'supervisor', jefe_id: 'g1', visitas_completadas: 2 }),
    fila({ usuario_id: 'a1', nombre: 'Luisa', rol: 'asesor', jefe_id: 's1', visitas_programadas: 3, visitas_completadas: 1 }),
    fila({ usuario_id: 's2', nombre: 'Otro', rol: 'supervisor', jefe_id: 'g1', visitas_completadas: 9 }),
    fila({ usuario_id: 'a2', nombre: 'Ana', rol: 'asesor', jefe_id: 's2', visitas_programadas: 5 }),
  ]
  const equipo = filasDelEquipo(filas, 's1')
  assert.deepEqual(
    equipo.map((f) => f.nombre).sort(),
    ['Erick', 'Luisa'],
  )
})

test('kpisDeFilas suma visitas y cuenta asesores', () => {
  const k = kpisDeFilas([
    fila({ rol: 'supervisor', visitas_programadas: 1, visitas_completadas: 2 }),
    fila({ rol: 'asesor', visitas_programadas: 4, visitas_completadas: 1, visitas_aprobadas: 1 }),
    fila({ rol: 'asesor', visitas_programadas: 0, visitas_completadas: 3 }),
  ])
  assert.equal(k.programadas, 5)
  assert.equal(k.completadas, 6)
  assert.equal(k.aprobadas, 1)
  assert.equal(k.asesoresActivos, 2)
  assert.equal(k.visitas, 12)
})

test('porcentajeCompletadas es 0 sin visitas y redondea el resto', () => {
  assert.equal(porcentajeCompletadas({ visitas: 0, completadas: 0, aprobadas: 0 }), 0)
  assert.equal(porcentajeCompletadas({ visitas: 8, completadas: 3, aprobadas: 1 }), 50)
})

test('rankingSupervisores ordena por completadas del equipo', () => {
  const ranking = rankingSupervisores(demoFilasDashboard())
  assert.ok(ranking.length >= 2)
  assert.ok(ranking[0].completadas >= ranking[1].completadas)
  assert.ok(ranking.every((r) => r.rol === 'supervisor'))
})

test('specIdsDashboard siempre expone W-02; W-02b solo en drill (H2)', () => {
  assert.deepEqual(specIdsDashboard('asesor'), { pagina: 'W-02', drill: null })
  assert.deepEqual(specIdsDashboard('supervisor'), { pagina: 'W-02', drill: null })
  assert.deepEqual(specIdsDashboard('admin'), { pagina: 'W-02', drill: 'W-02b' })
  assert.deepEqual(specIdsDashboard('gerente'), { pagina: 'W-02', drill: 'W-02b' })
  assert.deepEqual(specIdsDashboard(undefined), { pagina: 'W-02', drill: null })
})
