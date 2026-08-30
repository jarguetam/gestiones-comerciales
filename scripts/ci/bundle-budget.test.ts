import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { evaluateBudget } from './bundle-budget.mjs'

test('bundle-budget falla con fixture 2 MB', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gc-bundle-'))
  mkdirSync(join(dir, 'assets'))
  const huge = Buffer.alloc(2 * 1024 * 1024)
  for (let i = 0; i < huge.length; i += 65536) {
    huge.set(crypto.getRandomValues(new Uint8Array(Math.min(65536, huge.length - i))), i)
  }
  writeFileSync(join(dir, 'assets', 'index-aaaa.js'), huge)
  const r = evaluateBudget(dir)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /entry/.test(e)))
})

test('bundle-budget acepta entry chico y aísla Leaflet en mapa', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gc-bundle-ok-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'assets', 'index-bbbb.js'), 'console.log("app")')
  writeFileSync(join(dir, 'assets', 'mapa-cccc.js'), 'var leaflet = true')
  const r = evaluateBudget(dir)
  assert.equal(r.ok, true, r.errors.join('\n'))
})

test('bundle-budget falla si Leaflet está en el entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gc-bundle-leak-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'assets', 'index-dddd.js'), 'import "leaflet"')
  const r = evaluateBudget(dir)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /Leaflet/.test(e)))
})
