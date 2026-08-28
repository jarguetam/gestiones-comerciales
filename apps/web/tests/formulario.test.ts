import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  camposDe,
  scorePorcentajeCompletado,
  validarRespuestas,
} from '../src/lib/formulario.ts'

const FICHA = {
  campos: [
    { clave: 'cultivo', etiqueta: 'Cultivo', tipo: 'texto', requerido: true },
    { clave: 'hectareas', etiqueta: 'Hectáreas sembradas', tipo: 'numero', requerido: true, min: 0.1, max: 10000 },
    {
      clave: 'estado_fenologico',
      etiqueta: 'Estado fenológico',
      tipo: 'seleccion',
      requerido: true,
      opciones: ['Germinación', 'Cosecha'],
    },
    { clave: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', requerido: false },
  ],
}

test('camposDe lee esquema suavizado y aliases lista→seleccion', () => {
  const campos = camposDe({
    campos: [{ clave: 'ok', etiqueta: 'OK', tipo: 'lista', opciones: ['A'] }],
  })
  assert.equal(campos.length, 1)
  assert.equal(campos[0].tipo, 'seleccion')
})

test('validarRespuestas rechaza campo requerido vacío (GC-FORM-001)', () => {
  const r = validarRespuestas(FICHA, { hectareas: 2 })
  assert.equal(r.ok, false)
  if (r.ok) throw new Error('esperado rechazo')
  assert.match(r.codigo, /GC-FORM-001/)
  assert.match(r.mensaje, /cultivo/i)
})

test('validarRespuestas rechaza número fuera de rango', () => {
  const r = validarRespuestas(FICHA, {
    cultivo: 'Maíz',
    hectareas: 0,
    estado_fenologico: 'Cosecha',
  })
  assert.equal(r.ok, false)
  if (r.ok) throw new Error('esperado rechazo')
  assert.match(r.mensaje, /mínimo|minimo|bajo/i)
})

test('validarRespuestas rechaza opción inválida', () => {
  const r = validarRespuestas(FICHA, {
    cultivo: 'Maíz',
    hectareas: 2,
    estado_fenologico: 'Inventado',
  })
  assert.equal(r.ok, false)
  if (r.ok) throw new Error('esperado rechazo')
  assert.match(r.mensaje, /opcion/i)
})

test('validarRespuestas acepta payload válido', () => {
  const r = validarRespuestas(FICHA, {
    cultivo: 'Maíz',
    hectareas: 3.5,
    estado_fenologico: 'Cosecha',
  })
  assert.equal(r.ok, true)
})

test('score porcentaje_completado cuenta claves presentes', () => {
  const score = scorePorcentajeCompletado(FICHA, { cultivo: 'Maíz', hectareas: 2 })
  assert.equal(score, 50)
})

test('booleano y fecha se validan como requeridos', () => {
  const esquema = {
    campos: [
      { clave: 'aplica', etiqueta: 'Aplica', tipo: 'booleano', requerido: true },
      { clave: 'cuando', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
    ],
  }
  const mal = validarRespuestas(esquema, {})
  assert.equal(mal.ok, false)
  const ok = validarRespuestas(esquema, { aplica: false, cuando: '2026-08-28' })
  assert.equal(ok.ok, true)
})
