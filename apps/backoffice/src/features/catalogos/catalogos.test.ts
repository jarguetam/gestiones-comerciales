import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCsvGeografia, subactividadesDeTexto, validarPayloadPlantilla, mensajeError } from './catalogos.ts'

describe('parseCsvGeografia', () => {
  it('parsea encabezado y filas', () => {
    const filas = parseCsvGeografia('departamento,municipio\nGuatemala,Mixco\nEscuintla,Escuintla')
    assert.deepEqual(filas, [
      { departamento: 'Guatemala', municipio: 'Mixco' },
      { departamento: 'Escuintla', municipio: 'Escuintla' },
    ])
  })

  it('acepta CSV sin encabezado y comillas', () => {
    const filas = parseCsvGeografia('"Alta Verapaz","Cobán"')
    assert.deepEqual(filas, [{ departamento: 'Alta Verapaz', municipio: 'Cobán' }])
  })

  it('rechaza CSV vacío', () => {
    assert.throws(() => parseCsvGeografia('  \n'), /GC-CAT-001/)
  })

  it('rechaza fila incompleta', () => {
    assert.throws(() => parseCsvGeografia('departamento,municipio\nGuatemala'), /GC-CAT-001: fila 2/)
  })
})

describe('validarPayloadPlantilla', () => {
  it('acepta actividad con subactividades', () => {
    assert.equal(validarPayloadPlantilla('actividad', { sub_actividades: ['A'] }), null)
  })

  it('rechaza hora sin cantidad positiva', () => {
    assert.equal(validarPayloadPlantilla('hora', { cantidad: 0 }), 'GC-CAT-001: cantidad debe ser un número mayor a 0')
  })

  it('rechaza formulario sin campos', () => {
    assert.equal(
      validarPayloadPlantilla('formulario', { esquema: {} }),
      'GC-CAT-001: el formulario requiere esquema.campos',
    )
  })
})

describe('mensajeError', () => {
  it('extrae message de errores tipo PostgREST', () => {
    assert.equal(mensajeError({ message: 'GC-CAT-002: duplicado' }), 'GC-CAT-002: duplicado')
  })
})

describe('subactividadesDeTexto', () => {
  it('parte por líneas y descarta vacías', () => {
    assert.deepEqual(subactividadesDeTexto('A\n\n B \n'), ['A', 'B'])
  })
})
