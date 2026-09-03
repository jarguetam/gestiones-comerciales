import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('login web enlaza Privacidad', () => {
  const login = readFileSync('apps/web/src/features/auth/Login.tsx', 'utf8')
  assert.match(login, /Privacidad/)
  assert.match(login, /privacidad\.html/)
})

test('login backoffice y móvil enlazan Privacidad', () => {
  assert.match(readFileSync('apps/backoffice/src/features/auth/Login.tsx', 'utf8'), /Privacidad/)
  assert.match(readFileSync('apps/mobile/src/screens/LoginScreen.tsx', 'utf8'), /Privacidad/)
  assert.match(readFileSync('apps/mobile/src/screens/AjustesScreen.tsx', 'utf8'), /Privacidad/)
})

test('política de privacidad documenta rastreo 180d', () => {
  const html = readFileSync('apps/web/public/privacidad.html', 'utf8')
  assert.match(html, /180/)
  assert.match(html, /config_rastreo/)
  assert.match(html, /ubicación/i)
})
