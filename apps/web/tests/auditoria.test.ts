import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { textoDiff, demoAuditoria, filtrarAuditoria } from '../src/features/auditoria/auditoria.ts'

test('textoDiff resume claves del JSON de cambios', () => {
  assert.equal(textoDiff({}), 'sin cambios')
  assert.equal(textoDiff({ estado: 'aprobada' }), 'estado: "aprobada"')
  assert.match(textoDiff({ rol: 'asesor', activo: false }), /rol: "asesor"/)
  assert.match(textoDiff({ rol: 'asesor', activo: false }), /activo: false/)
})

test('demoAuditoria incluye tablas de negocio y acciones', () => {
  const rows = demoAuditoria()
  assert.ok(rows.length >= 3)
  assert.ok(rows.every((r) => r.tabla && r.accion && r.creado_en))
  assert.ok(rows.some((r) => r.accion === 'update'))
  assert.ok(rows.some((r) => r.tabla === 'visita' || r.tabla === 'persona'))
})

test('filtrarAuditoria busca por tabla, acción o registro', () => {
  const rows = demoAuditoria()
  const q = filtrarAuditoria(rows, 'visita')
  assert.ok(q.length > 0)
  assert.ok(q.every((r) => `${r.tabla} ${r.accion} ${r.registro_id}`.toLowerCase().includes('visita')))
  assert.equal(filtrarAuditoria(rows, '').length, rows.length)
})
