import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('subordinados(uuid) existe antes de que dashboard_asesor lo llame', () => {
  const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
  let definedAt = ''
  let usedAt = ''
  for (const file of files) {
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8')
    if (!definedAt && /create\s+or\s+replace\s+function\s+public\.subordinados\s*\(\s*p_raiz\s+uuid/i.test(sql)) {
      definedAt = file
    }
    if (!usedAt && /subordinados\s*\(\s*p_usuario_id\s*\)/.test(sql)) {
      usedAt = file
    }
  }
  assert.ok(definedAt, 'falta overload subordinados(p_raiz uuid)')
  assert.ok(usedAt, 'nadie llama subordinados(p_usuario_id)')
  assert.ok(definedAt <= usedAt, `${definedAt} debe ordenar antes o igual que ${usedAt}`)
})
