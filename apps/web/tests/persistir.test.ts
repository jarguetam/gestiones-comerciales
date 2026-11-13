import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { argsVisitaCrear, errorAltaPersona, filaDePersona, mensajeGc } from '../src/lib/persistirHelpers.ts'

/** Repro del modal: PostgREST no es instanceof Error → se tragaba el 42501. */
test('mensajeGc no traga el 42501 de PostgREST (objeto, no Error)', () => {
  const err = {
    code: '42501',
    message: 'new row violates row-level security policy for table "persona"',
    details: null,
    hint: null,
  }
  assert.equal(err instanceof Error, false)
  const tragado = err instanceof Error ? err.message : 'No se pudo registrar el cliente'
  assert.equal(tragado, 'No se pudo registrar el cliente')
  const msg = mensajeGc(err)
  assert.match(msg, /GC-PER-001/)
  assert.match(msg, /row-level security|persona/)
})

test('errorAltaPersona usa el mensaje de negocio, no el fallback genérico', () => {
  const err = {
    code: '42501',
    message: 'new row violates row-level security policy for table "persona"',
  }
  assert.match(errorAltaPersona(err), /GC-PER-001/)
  assert.equal(errorAltaPersona(err).includes('No se pudo registrar el cliente'), false)
})

test('mensajeGc traduce unique 23505 a GC-PER-030', () => {
  const err = {
    code: '23505',
    message: 'duplicate key value violates unique constraint',
  }
  assert.match(mensajeGc(err), /GC-PER-030/)
})

test('filaDePersona mapea teléfono a detalles y documento vacío a null', () => {
  const fila = filaDePersona(
    {
      id: 'p99',
      nombre: 'Test',
      categoria: 'Prospecto — En evaluación',
      documento: 'Sin documento',
      telefono: '958555',
      direccion: 'Tres',
      visitasPendientes: 1,
    },
    { usuarioId: 'aaaaaaaa-0000-0000-0000-000000000004', tenantId: '11111111-1111-1111-1111-111111111111' },
  )
  assert.equal(fila.nombre, 'Test')
  assert.equal(fila.documento, null)
  assert.equal(fila.direccion, 'Tres')
  assert.equal(fila.categoria, 'Prospecto — En evaluación')
  assert.equal(fila.tenant_id, '11111111-1111-1111-1111-111111111111')
  assert.equal(fila.asesor_id, 'aaaaaaaa-0000-0000-0000-000000000004')
  assert.deepEqual(fila.detalles, { telefono: '958555' })
})

test('filaDePersona omite teléfono placeholder y documento real', () => {
  const fila = filaDePersona(
    {
      id: 'p1',
      nombre: 'Test',
      categoria: 'Prospecto — En evaluación',
      documento: '0501199403142',
      telefono: '—',
      direccion: '—',
      visitasPendientes: 1,
    },
    { usuarioId: 'u1', tenantId: 't1' },
  )
  assert.equal(fila.documento, '0501199403142')
  assert.equal(fila.direccion, null)
  assert.deepEqual(fila.detalles, {})
})

const eventoBase = {
  id: 'tmp',
  title: 'Visita',
  date: '2026-09-01',
  startTime: '09:00',
  actividadId: 3,
  subActividadId: 4,
  personaName: 'Ana',
  personaId: '12',
} as unknown as Parameters<typeof argsVisitaCrear>[0]

test('argsVisitaCrear manda geografía nula y la clave', () => {
  const a = argsVisitaCrear(eventoBase, 7, 'k1')
  assert.equal(a.p_zona_id, null)
  assert.equal(a.p_departamento_id, null)
  assert.equal(a.p_municipio_id, null)
  assert.equal(a.p_cliente_key, 'k1')
  assert.equal(a.p_hora_inicio, '09:00:00')
  assert.equal(a.p_comentario, 'Visita')
  assert.equal(a.p_persona_nombre, 'Ana')
})

test('usa el bloque de horas por defecto', () => {
  assert.equal(argsVisitaCrear(eventoBase, 7, 'k').p_actividad_hora_id, 7)
  const conHora = { ...eventoBase, actividadHoraId: 9 } as typeof eventoBase
  assert.equal(argsVisitaCrear(conHora, 7, 'k').p_actividad_hora_id, 9)
})

test('persona numérica se convierte y la demo no', () => {
  assert.equal(argsVisitaCrear(eventoBase, 7, 'k').p_persona_id, 12)
  const demo = { ...eventoBase, personaId: 'vis-x' } as typeof eventoBase
  assert.equal(argsVisitaCrear(demo, 7, 'k').p_persona_id, null)
})

test('GC-VIS-001 sin subactividad', () => {
  const e = { ...eventoBase, subActividadId: undefined } as typeof eventoBase
  assert.throws(() => argsVisitaCrear(e, 7, 'k'), /GC-VIS-001/)
})

test('GC-VIS-003 sin horas', () => {
  assert.throws(() => argsVisitaCrear(eventoBase, null, 'k'), /GC-VIS-003/)
})
