import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { buttonClass } from '../src/components/ui/buttonVariants.ts'
import { EMPTY_STATE_ROOT, emptyStateValido } from '../src/components/ui/emptyStateModel.ts'
import { quetzales } from '../src/lib/formato.ts'
import { extraerCodigoGc, mensajeToast } from '../src/lib/erroresUi.ts'
import { lineaTiempoVisita } from '../src/lib/visitaTimeline.ts'
import { cn } from '../src/lib/cn.ts'

test('buttonClass primary usa token primary y focus visible', () => {
  const c = buttonClass('primary', 'md')
  assert.match(c, /bg-primary/)
  assert.match(c, /focus-visible:ring-primary/)
  assert.match(c, /min-h-11/)
  assert.match(c, /duration-campo/)
  assert.doesNotMatch(c, /bg-brand-700/)
})

test('buttonClass secondary, danger y tamaños son distintos', () => {
  const sec = buttonClass('secondary', 'sm')
  const dan = buttonClass('danger', 'lg')
  assert.match(sec, /border-line/)
  assert.match(sec, /text-xs/)
  assert.match(dan, /bg-danger/)
  assert.match(dan, /w-full/)
  assert.notEqual(sec, dan)
})

test('EmptyState exige título y usa tokens de superficie', () => {
  assert.equal(emptyStateValido({ titulo: 'Sin visitas' }), true)
  assert.equal(emptyStateValido({ titulo: '  ' }), false)
  assert.match(EMPTY_STATE_ROOT, /border-line/)
  assert.match(EMPTY_STATE_ROOT, /bg-surface/)
})

test('quetzales formatea GTQ', () => {
  const t = quetzales(25000)
  assert.match(t, /25/)
  assert.match(t, /Q|GTQ/)
})

test('mensajeToast separa código GC-* del texto humano', () => {
  assert.equal(extraerCodigoGc('GC-CRM-002: motivo requerido'), 'GC-CRM-002')
  const m = mensajeToast(new Error('GC-KM-001: km_final no puede ser menor que km_inicial'))
  assert.equal(m.descripcion, 'GC-KM-001')
  assert.match(m.titulo, /km_final|menor/i)
})

test('lineaTiempoVisita marca el paso actual y anulación', () => {
  const prog = lineaTiempoVisita('programada')
  assert.equal(prog[0].fase, 'actual')
  assert.equal(prog[1].fase, 'pendiente')
  const ok = lineaTiempoVisita('aprobada')
  assert.equal(ok[2].fase, 'actual')
  assert.equal(ok[2].etiqueta, 'Aprobada')
  const anul = lineaTiempoVisita('anulada')
  assert.equal(anul.at(-1)?.clave, 'anulada')
})

test('lineaTiempoVisita no inventa check-in sin GPS ni timestamps', () => {
  const sinGps = lineaTiempoVisita('completada')
  assert.equal(sinGps.some((p) => p.clave === 'checkin'), false)
  assert.equal(sinGps.find((p) => p.clave === 'completada')?.cuando ?? null, null)
  const conGps = lineaTiempoVisita('programada', { latitud: 14.6, longitud: -90.5, creadoEn: '2026-08-01T08:00:00Z' })
  const checkin = conGps.find((p) => p.clave === 'checkin')
  assert.ok(checkin)
  assert.equal(checkin?.cuando, undefined)
  assert.match(checkin?.detalle ?? '', /14\.6/)
  assert.equal(conGps[0].cuando, '2026-08-01T08:00:00Z')
})

test('cn omite valores vacíos', () => {
  assert.equal(cn('a', false, undefined, 'b'), 'a b')
})
