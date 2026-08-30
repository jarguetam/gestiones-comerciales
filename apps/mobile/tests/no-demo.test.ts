import { strict as assert } from 'node:assert'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const srcRoot = fileURLToPath(new URL('../src', import.meta.url))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const PROHIBIDO = [
  'DEMO_MODE',
  'activarSesionDemo',
  'desactivarSesionDemo',
  'PERFIL_DEMO',
  'DEMO_VISITAS',
  'ejecutarDemo',
  'resetColaDemo',
  'Entrar al tablero',
]

test('no queda DEMO_MODE ni seeds de demo en src', () => {
  for (const file of walk(srcRoot)) {
    const s = readFileSync(file, 'utf8')
    const rel = file.slice(srcRoot.length + 1)
    for (const token of PROHIBIDO) {
      assert.equal(s.includes(token), false, `${rel} contiene ${token}`)
    }
  }
})
