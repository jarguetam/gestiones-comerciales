import { readFileSync, globSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const webRoot = fileURLToPath(new URL('..', import.meta.url))

test('no queda DEMO_MODE en src', () => {
  const files = globSync('src/**/*.{ts,tsx}', { cwd: webRoot })
  assert.ok(files.length > 10, 'debe encontrar fuentes de web')
  for (const rel of files) {
    const s = readFileSync(join(webRoot, rel), 'utf8')
    assert.equal(s.includes('DEMO_MODE'), false, rel)
    assert.equal(s.includes('activarSesionDemo'), false, rel)
    assert.equal(s.includes('Entrar al tablero'), false, rel)
  }
})

test('cargarDominio no menciona AgroMoney como fallback', () => {
  const s = readFileSync(join(webRoot, 'src/lib/cargarDominio.ts'), 'utf8')
  assert.equal(/AgroMoney/.test(s) && /catch/.test(s), false)
})
