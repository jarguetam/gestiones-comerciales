import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('seed sintético no contiene PII de prod', () => {
  const sql = readFileSync('supabase/seeds/staging_synthetic.sql', 'utf8')
  assert.equal(sql.includes('@gmail.com'), false)
  assert.doesNotMatch(sql, /jarguetam|luisa asesora|ana asesora|erick supervisor/i)
  assert.match(sql, /Acme Staging/)
  assert.match(sql, /asesor@staging\.test/)
})
