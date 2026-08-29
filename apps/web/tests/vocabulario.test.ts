import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { etiquetaVocab } from '../src/lib/vocabulario.ts'
import { brandingDeJson } from '../src/lib/branding.ts'
import { mensajeToast, mensajeCatalogo } from '../src/lib/erroresUi.ts'

test('etiquetaVocab usa branding.vocabulario y cae al label actual', () => {
  assert.equal(etiquetaVocab({}, 'persona'), 'Personas')
  assert.equal(etiquetaVocab({ vocabulario: { persona: 'Clientes' } }, 'persona'), 'Clientes')
  assert.equal(etiquetaVocab({ vocabulario: { persona: '  ' } }, 'persona', 'Personas'), 'Personas')
})

test('brandingDeJson lee vocabulario', () => {
  const b = brandingDeJson({ vocabulario: { persona: 'Punto de venta', visita: 'Ruta' } })
  assert.equal(b.vocabulario?.persona, 'Punto de venta')
  assert.equal(b.vocabulario?.visita, 'Ruta')
})

test('mensajeToast usa catálogo i18n para GC-*', () => {
  assert.equal(mensajeCatalogo('GC-CRM-002'), 'Marcar el lead como perdido exige un motivo.')
  const m = mensajeToast(new Error('GC-CRM-002: motivo requerido'))
  assert.equal(m.descripcion, 'GC-CRM-002')
  assert.match(m.titulo, /motivo/i)
})
