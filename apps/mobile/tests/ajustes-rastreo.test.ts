import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const ajustes = readFileSync(new URL('../src/screens/AjustesScreen.tsx', import.meta.url), 'utf8')
const estado = readFileSync(new URL('../src/components/RastreoEstado.tsx', import.meta.url), 'utf8')

test('AjustesScreen no renderiza switch de rastreo', () => {
  assert.equal(/rastreo[\s\S]{0,80}Switch/i.test(ajustes), false)
  assert.equal(ajustes.includes('<Switch'), false)
})

test('RastreoEstado es solo lectura y no usa Switch', () => {
  assert.equal(estado.includes('Switch'), false)
  assert.match(estado, /Activo · cada/)
  assert.match(estado, /Bloqueado: activá Ubicación/)
})
