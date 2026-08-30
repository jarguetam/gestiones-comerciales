import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as {
  expo: { extra?: { eas?: { projectId?: string } } }
}
const gitignore = readFileSync(new URL('../../../.gitignore', import.meta.url), 'utf8')
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')) as {
  build?: Record<string, { ios?: unknown; android?: { buildType?: string } }>
  submit?: Record<string, { ios?: unknown }>
}

test('app.json tiene extra.eas.projectId no vacío', () => {
  assert.ok((appJson.expo.extra?.eas?.projectId ?? '').length > 10)
})

test('gitignore no exceptúa APKs', () => {
  assert.equal(gitignore.includes('!apps/mobile/releases/*.apk'), false)
  assert.equal(gitignore.includes('!releases/*.apk'), false)
})

test('eas.json no define profiles ni submit iOS', () => {
  for (const [nombre, perfil] of Object.entries(eas.build ?? {})) {
    assert.equal(perfil.ios, undefined, `build.${nombre} no debe tener ios`)
  }
  for (const [nombre, perfil] of Object.entries(eas.submit ?? {})) {
    assert.equal(perfil.ios, undefined, `submit.${nombre} no debe tener ios`)
  }
})

test('preview es APK y production es AAB', () => {
  assert.equal(eas.build?.preview?.android?.buildType, 'apk')
  assert.equal(eas.build?.production?.android?.buildType, 'app-bundle')
})
