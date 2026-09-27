import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  expo?: { install?: { exclude?: string[] } }
}

test('SDK 54 alinea React/RN con las versiones del SDK instalado', () => {
  const require = createRequire(new URL('../package.json', import.meta.url))
  const expo = require('expo/package.json') as { version: string }
  const bundled = require('expo/bundledNativeModules.json') as Record<string, string>
  assert.match(expo.version, /^54\./)
  assert.equal(pkg.dependencies.react, bundled.react)
  assert.equal(pkg.dependencies['react-native'], bundled['react-native'])
})

test('TypeScript móvil se valida con Expo y usa la línea 5.9', () => {
  assert.equal(pkg.expo?.install?.exclude?.includes('typescript') ?? false, false)
  assert.match(pkg.devDependencies.typescript, /^~5\.9\./)
})

test('tsconfig declara module ESNext (import dinámico para Sentry/Location)', () => {
  const ts = JSON.parse(readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8')) as {
    compilerOptions?: { module?: string }
  }
  assert.equal(ts.compilerOptions?.module, 'ESNext')
})

test('el selector de fotos no agrega acceso al micrófono', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
  const picker = app.expo.plugins.find((plugin: unknown) =>
    Array.isArray(plugin) && plugin[0] === 'expo-image-picker')
  assert.equal(picker[1].microphonePermission, false)
})
