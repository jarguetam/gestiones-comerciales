import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { agendaConCola, descargarAgenda, mapFilaVisita, rangoAgenda } from '../src/lib/agendaLocal.ts'
import type { ItemCola } from '../src/lib/cola.ts'
import type { Visita } from '../src/lib/tipos.ts'

const FECHA = '2026-11-14'

function itemVisita(over: Partial<ItemCola> = {}, pay: Record<string, unknown> = {}): ItemCola {
  return {
    id: 'c1',
    tipo: 'visita',
    payload: {
      clienteKey: 'u1',
      personaNombre: 'Ana',
      actividadId: 1,
      subActividadId: 2,
      actividadHoraId: 3,
      fecha: FECHA,
      horaInicio: '09:00',
      direccion: 'Zona 1',
      ...pay,
    },
    estado: 'pendiente',
    intentos: 0,
    maxIntentos: 5,
    clienteKey: 'visita:u1',
    creadoEn: '2026-11-14T08:00:00Z',
    proximoIntentoEn: 0,
    ...over,
  }
}

function itemMut(
  tipo: 'visita_checkin' | 'visita_completar',
  over: Partial<ItemCola> = {},
  pay: Record<string, unknown> = {},
): ItemCola {
  return {
    id: 'c2',
    tipo,
    payload: { visitaClienteKey: 'u1', latitud: 14.6, longitud: -90.5, ...pay },
    estado: 'pendiente',
    intentos: 0,
    maxIntentos: 5,
    clienteKey: `${tipo}:u1`,
    creadoEn: '2026-11-14T08:00:00Z',
    proximoIntentoEn: 0,
    ...over,
  }
}

function base(over: Partial<Visita> = {}): Visita {
  return {
    id: 10,
    cliente_key: 'u1',
    persona_nombre: 'Ana',
    direccion: null,
    fecha_visita: FECHA,
    hora_inicio: '09:00:00',
    estado: 'programada',
    actividad: null,
    latitud: null,
    longitud: null,
    ...over,
  }
}

test('visita creada sin señal aparece pendiente y programada', () => {
  const r = agendaConCola([], [itemVisita()], FECHA)
  assert.equal(r.length, 1)
  assert.equal(r[0].id, null)
  assert.equal(r[0].cliente_key, 'u1')
  assert.equal(r[0].pendiente, true)
  assert.equal(r[0].estado, 'programada')
  assert.equal(r[0].persona_nombre, 'Ana')
})

test('si el servidor ya la trae no se duplica', () => {
  const r = agendaConCola([base()], [itemVisita()], FECHA)
  assert.equal(r.length, 1)
  assert.ok(!r[0].pendiente)
  assert.equal(r[0].id, 10)
})

test('cierre pendiente la muestra completada', () => {
  const r = agendaConCola([base()], [itemMut('visita_completar')], FECHA)
  assert.equal(r[0].estado, 'completada')
  assert.equal(r[0].pendiente, true)
})

test('check-in pendiente pone las coordenadas del payload', () => {
  const r = agendaConCola([base()], [itemMut('visita_checkin')], FECHA)
  assert.equal(r[0].latitud, 14.6)
  assert.equal(r[0].longitud, -90.5)
  assert.equal(r[0].pendiente, true)
})

test('visita enviada que la base aún no trae sigue visible', () => {
  const r = agendaConCola([], [itemVisita({ estado: 'enviado' })], FECHA)
  assert.equal(r.length, 1)
  assert.ok(!r[0].pendiente)
})

test('cierre enviado con base vieja se ve completada', () => {
  const r = agendaConCola([base()], [itemMut('visita_completar', { estado: 'enviado' })], FECHA)
  assert.equal(r[0].estado, 'completada')
  assert.ok(!r[0].pendiente)
})

test('la base que ya refleja el cierre manda', () => {
  const r = agendaConCola([base({ estado: 'aprobada' })], [itemMut('visita_completar')], FECHA)
  assert.equal(r[0].estado, 'aprobada')
  assert.ok(!r[0].pendiente)
})

test('ignora ítems de otra fecha', () => {
  const r = agendaConCola([], [itemVisita({}, { fecha: '2026-11-15' })], FECHA)
  assert.equal(r.length, 0)
})

test('ordena por hora de inicio', () => {
  const r = agendaConCola(
    [base({ id: 1, cliente_key: 'b', hora_inicio: '14:00:00' }), base({ id: 2, cliente_key: 'c', hora_inicio: null })],
    [itemVisita({}, { horaInicio: '08:30' })],
    FECHA,
  )
  assert.deepEqual(
    r.map((v) => v.cliente_key),
    ['u1', 'b', 'c'],
  )
})

test('visita creada sin señal y cerrada sin señal: completada y pendiente', () => {
  const r = agendaConCola([], [itemVisita(), itemMut('visita_completar')], FECHA)
  assert.equal(r.length, 1)
  assert.equal(r[0].estado, 'completada')
  assert.equal(r[0].pendiente, true)
})

test('no muta la base ni la cola', () => {
  const b = [base()]
  const c = [itemMut('visita_completar')]
  const b0 = JSON.stringify(b)
  const c0 = JSON.stringify(c)
  agendaConCola(b, c, FECHA)
  assert.equal(JSON.stringify(b), b0)
  assert.equal(JSON.stringify(c), c0)
})

test('rangoAgenda cruza mes y año sin zona horaria', () => {
  assert.deepEqual(rangoAgenda('2026-11-30', 7), { desde: '2026-11-30', hasta: '2026-12-06' })
  assert.deepEqual(rangoAgenda('2026-12-29', 7), { desde: '2026-12-29', hasta: '2027-01-04' })
  assert.deepEqual(rangoAgenda('2028-02-27', 3), { desde: '2028-02-27', hasta: '2028-02-29' })
})

test('mapFilaVisita incluye cliente_key y actividad anidada', () => {
  const v = mapFilaVisita({
    id: '5',
    cliente_key: 'k',
    persona_nombre: 'X',
    fecha_visita: FECHA,
    actividad: { nombre: 'Cobro' },
  })
  assert.equal(v.id, 5)
  assert.equal(v.cliente_key, 'k')
  assert.equal(v.actividad, 'Cobro')
  assert.equal(v.estado, 'programada')
})

test('descargarAgenda consulta el rango sin filtrar por usuario y lanza el error', async () => {
  const llamadas: unknown[][] = []
  const mk = (res: { data: unknown; error: unknown }) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'gte', 'lte', 'order', 'eq']) {
      q[m] = (...a: unknown[]) => {
        llamadas.push([m, ...a])
        return q
      }
    }
    q.then = (ok: (r: unknown) => unknown) => ok(res)
    return { from: () => q }
  }
  const ok = await descargarAgenda(
    mk({ data: [{ id: 1, cliente_key: 'k', persona_nombre: 'X', fecha_visita: FECHA }], error: null }) as never,
    '2026-11-30',
  )
  assert.equal(ok.length, 1)
  assert.ok(llamadas.some((c) => c[0] === 'gte' && c[2] === '2026-11-30'))
  assert.ok(llamadas.some((c) => c[0] === 'lte' && c[2] === '2026-12-06'))
  assert.ok(!llamadas.some((c) => c[0] === 'eq'))
  const err = new Error('boom')
  await assert.rejects(descargarAgenda(mk({ data: null, error: err }) as never, FECHA), (e) => e === err)
})

test('agendaConCola: visita en error lleva errorEnvio y sigue pendiente', () => {
  const r = agendaConCola([], [itemVisita({ estado: 'error', intentos: 1, ultimoError: 'GC-VIS-002: actividad inválida' })], FECHA)
  assert.equal(r[0].errorEnvio, 'GC-VIS-002: actividad inválida')
  assert.equal(r[0].pendiente, true)
})

test('agendaConCola: completar en error conserva estado local y lleva errorEnvio', () => {
  const r = agendaConCola(
    [base()],
    [itemMut('visita_completar', { estado: 'error', intentos: 1, ultimoError: 'GC-VIS-009: no se puede cerrar' })],
    FECHA,
  )
  assert.equal(r[0].estado, 'completada')
  assert.equal(r[0].errorEnvio, 'GC-VIS-009: no se puede cerrar')
  assert.equal(r[0].pendiente, true)
})

test('agendaConCola: ítem pendiente sin error no lleva errorEnvio', () => {
  const r = agendaConCola([], [itemVisita()], FECHA)
  assert.equal(r[0].errorEnvio, undefined)
})
