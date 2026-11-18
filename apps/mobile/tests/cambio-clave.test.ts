import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  debeCambiarClave,
  decidirCambioClave,
  mensajeErrorCambioClave,
  validarClaveNueva,
  MSG_CLAVE_CORTA,
  MSG_CLAVES_NO_COINCIDEN,
  MSG_CLAVE_IGUAL,
  MSG_CAMBIO_SIN_RED,
  MSG_CAMBIO_GENERICO,
  MSG_CAMBIO_HECHO_SIN_CONFIRMAR,
} from '../src/lib/cambioClave.ts'

test('debeCambiarClave solo con boolean true', () => {
  assert.equal(debeCambiarClave({ app_metadata: { debe_cambiar_clave: true } }), true)
  assert.equal(debeCambiarClave(null), false)
  assert.equal(debeCambiarClave(undefined), false)
  assert.equal(debeCambiarClave({}), false)
  assert.equal(debeCambiarClave({ app_metadata: null }), false)
  assert.equal(debeCambiarClave({ app_metadata: {} }), false)
  assert.equal(debeCambiarClave({ app_metadata: { debe_cambiar_clave: 'true' } }), false)
  assert.equal(debeCambiarClave({ app_metadata: { debe_cambiar_clave: 1 } }), false)
  assert.equal(debeCambiarClave({ app_metadata: { debe_cambiar_clave: false } }), false)
})

test('validarClaveNueva', () => {
  assert.equal(validarClaveNueva('1234567', '1234567'), 'GC-AUTH-034: la contraseña debe tener al menos 8 caracteres')
  assert.equal(validarClaveNueva('12345678', '12345679'), 'GC-AUTH-035: las contraseñas no coinciden')
  assert.equal(validarClaveNueva('12345678', '12345678'), null)
  assert.equal(validarClaveNueva('        ', '        '), null)
})

test('mensajeErrorCambioClave', () => {
  assert.equal(mensajeErrorCambioClave({ code: 'same_password' }), 'GC-AUTH-036: la contraseña nueva debe ser distinta de la temporal')
  assert.equal(mensajeErrorCambioClave({ code: 'weak_password' }), 'GC-AUTH-034: la contraseña debe tener al menos 8 caracteres')
  assert.equal(mensajeErrorCambioClave({ name: 'AuthRetryableFetchError', status: 0 }), 'GC-AUTH-037: sin conexión; no se pudo cambiar la contraseña')
  assert.equal(mensajeErrorCambioClave({ status: 0 }), 'GC-AUTH-037: sin conexión; no se pudo cambiar la contraseña')
  assert.equal(mensajeErrorCambioClave(new TypeError('Failed to fetch')), 'GC-AUTH-037: sin conexión; no se pudo cambiar la contraseña')
  assert.equal(mensajeErrorCambioClave({ message: 'x' }), 'GC-AUTH-038: no se pudo cambiar la contraseña')
  assert.equal(mensajeErrorCambioClave(null), 'GC-AUTH-038: no se pudo cambiar la contraseña')
})

test('constantes de mensaje GC-AUTH-034 a 039', () => {
  assert.equal(MSG_CLAVE_CORTA, 'GC-AUTH-034: la contraseña debe tener al menos 8 caracteres')
  assert.equal(MSG_CLAVES_NO_COINCIDEN, 'GC-AUTH-035: las contraseñas no coinciden')
  assert.equal(MSG_CLAVE_IGUAL, 'GC-AUTH-036: la contraseña nueva debe ser distinta de la temporal')
  assert.equal(MSG_CAMBIO_SIN_RED, 'GC-AUTH-037: sin conexión; no se pudo cambiar la contraseña')
  assert.equal(MSG_CAMBIO_GENERICO, 'GC-AUTH-038: no se pudo cambiar la contraseña')
  assert.equal(
    MSG_CAMBIO_HECHO_SIN_CONFIRMAR,
    'GC-AUTH-039: tu contraseña ya se cambió, pero no se pudo confirmar la sesión; revisa la conexión y pulsa Reintentar',
  )
})

test('decidirCambioClave', () => {
  assert.equal(decidirCambioClave({ app_metadata: { debe_cambiar_clave: true } }), 'pedir')
  assert.equal(decidirCambioClave({ app_metadata: {} }), 'liberar')
  assert.equal(decidirCambioClave(null), 'liberar')
})

// --- perfilSinConexion: la marca sale de la sesión guardada, no de la copia del perfil ---
import { perfilSinConexion, type SesionGuardada } from '../src/lib/sesionSinConexion.ts'
import { cacheMemoria } from '../src/lib/cacheCampo.ts'
import { claveParticionCola } from '../src/lib/colaParticion.ts'

function jwtCon(payload: Record<string, unknown>): string {
  const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${h}.${b}.sig`
}

async function cacheConPerfil(debeCambiarClave: boolean) {
  const cache = cacheMemoria()
  await cache.guardar(claveParticionCola('t1', 'u1'), 'perfil', { id: 'u1', tenantId: 't1', nombre: 'Ana', rol: 'asesor', modulos: [], branding: {}, debeCambiarClave })
  return cache
}

function sesion(appMetadata?: Record<string, unknown>): SesionGuardada {
  return {
    access_token: jwtCon({ tenant_id: 't1', rol: 'asesor' }),
    refresh_token: 'r',
    user: { id: 'u1', email: 'ana@x.com', app_metadata: appMetadata },
  }
}

test('perfilSinConexion: la marca de la sesión gana a la copia guardada', async () => {
  const p = await perfilSinConexion(sesion({ debe_cambiar_clave: true }), await cacheConPerfil(false), () => {})
  assert.equal(p?.debeCambiarClave, true)
})

test('perfilSinConexion: sin marca en la sesión da false aunque la copia diga true', async () => {
  const cache = await cacheConPerfil(true)
  const p = await perfilSinConexion(sesion({}), cache, () => {})
  assert.equal(p?.debeCambiarClave, false)
})
