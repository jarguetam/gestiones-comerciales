import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('la pantalla espera la partición del perfil antes de habilitar campo y sync', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /claveParticionCola\(perfil\.tenantId, perfil\.id\)/)
  assert.match(app, /colaLista !== claveCola/)
  assert.match(app, /persist\.load\(claveCola\)/)
  assert.match(app, /persist\.save\(claveCola, items\)/)
  assert.match(app, /await hidratarDesdePersistencia\(\)/)
})
