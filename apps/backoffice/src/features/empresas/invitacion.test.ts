import assert from 'node:assert/strict'
import test from 'node:test'
import { jefeParaInvitacion } from './invitacion.ts'

const usuarios = [
  { id: 'supervisor-activo', rol: 'supervisor', activo: true },
  { id: 'supervisor-inactivo', rol: 'supervisor', activo: false },
  { id: 'gerente-activo', rol: 'gerente', activo: true },
]

test('el asesor requiere un supervisor activo del tenant', () => {
  assert.equal(jefeParaInvitacion('asesor', 'supervisor-activo', usuarios), 'supervisor-activo')
  assert.throws(() => jefeParaInvitacion('asesor', '', usuarios), /supervisor activo/)
  assert.throws(() => jefeParaInvitacion('asesor', 'supervisor-inactivo', usuarios), /supervisor activo/)
  assert.throws(() => jefeParaInvitacion('asesor', 'gerente-activo', usuarios), /supervisor activo/)
})

test('otros roles se invitan sin jefe asignado', () => {
  assert.equal(jefeParaInvitacion('supervisor', '', usuarios), null)
})
