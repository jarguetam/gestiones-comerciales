import assert from 'node:assert/strict'
import test from 'node:test'
import { validarPaso3, wizardInicial } from './wizard.ts'

test('permite crear una empresa solo con los módulos del núcleo', () => {
  assert.equal(validarPaso3({ ...wizardInicial, paso: 3, modulos: [] }), null)
})
