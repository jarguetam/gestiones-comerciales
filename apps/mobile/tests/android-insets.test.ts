import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('la raíz protege login y navegación con insets nativos sin duplicar la barra de estado', () => {
  const app = source('App.tsx')
  assert.match(app, /import.*SafeAreaProvider.*from 'react-native-safe-area-context'/)
  assert.match(app, /<SafeAreaProvider[\s>]/)
  assert.doesNotMatch(app, /StatusBar\.currentHeight/)
})

test('cada modal usa el contenedor que mide los insets de su ventana', () => {
  for (const path of ['App.tsx', 'screens/DepositosScreen.tsx', 'screens/LeadsScreen.tsx',
    'screens/NuevaVisitaModal.tsx', 'screens/SolicitudesScreen.tsx']) {
    assert.match(source(path), /import \{ ModalSeguro as Modal \}/, path)
  }
  const modal = source('components/ui/ModalSeguro.tsx')
  assert.match(modal, /<SafeAreaProvider[\s>]/)
  assert.match(modal, /<SafeAreaView[\s>]/)
})
