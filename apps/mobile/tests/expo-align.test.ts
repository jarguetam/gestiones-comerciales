import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>
  expo?: { install?: { exclude?: string[] } }
}

test('React/RN alineados al peer de Expo SDK 51', () => {
  assert.equal(pkg.dependencies.react, '18.2.0')
  assert.equal(pkg.dependencies['react-native'], '0.74.5')
})

test('typescript queda excluido de expo install (monorepo 5.5)', () => {
  assert.ok(pkg.expo?.install?.exclude?.includes('typescript'))
})
