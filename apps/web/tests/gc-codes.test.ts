import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import catalogo from '../src/locales/es/errors.json' with { type: 'json' }

function gcCodesDelIndice(): string[] {
  const index = readFileSync(
    new URL('../../../docs/superpowers/plans/2026-08-29-production-hardening-index.md', import.meta.url),
    'utf8',
  )
  const start = index.indexOf('export type GcCode')
  const end = index.indexOf('export interface WebhookSecretStatus')
  assert.ok(start >= 0 && end > start, 'bloque GcCode en el índice')
  const block = index.slice(start, end)
  return [...block.matchAll(/'(GC-[A-Z]+-\d{3})'/g)].map((m) => m[1])
}

test('cada GcCode del índice tiene mensaje humano en errors.json', () => {
  const codes = gcCodesDelIndice()
  assert.ok(codes.length >= 40, `se esperaban ≥40 códigos, hay ${codes.length}`)
  const faltan = codes.filter((c) => {
    const msg = (catalogo as Record<string, string>)[c]
    return !msg || !msg.trim()
  })
  assert.deepEqual(faltan, [])
})
