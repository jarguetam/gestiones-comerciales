import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { cacheMemoria } from '../src/lib/cacheCampo.ts'
import {
  cargarCartera,
  cargarCatalogosCampo,
  LIMITE_PERSONAS_CAMPO,
  type CatalogosCampo,
} from '../src/lib/catalogosCampo.ts'

const CLAVE = 't1:u1'

interface Opciones {
  session?: unknown
  totalPersonas?: number
  falloRed?: boolean
  errorPersona?: unknown
}

/** Cliente falso: catálogos chicos fijos y `persona` servida por rangos. */
function clienteFalso(o: Opciones = {}) {
  const llamadas: unknown[][] = []
  const total = o.totalPersonas ?? 3
  const tablas: Record<string, unknown[]> = {
    actividad: [{ id: 1, nombre: 'Cobro', activo: true }],
    sub_actividad: [{ id: 11, actividad_id: 1, nombre: 'Mora', activo: true }],
    actividad_hora: [{ id: 5, nombre: '1 hora', cantidad: 60, activo: true }],
    zona: [{ id: 7, codigo: 'SPS', nombre: 'San Pedro Sula', activo: true }],
  }
  const cliente = {
    auth: { getSession: async () => ({ data: { session: o.session === undefined ? { access_token: 'jwt' } : o.session } }) },
    from: (tabla: string) => {
      llamadas.push(['from', tabla])
      let rango: [number, number] | null = null
      let limite: number | null = null
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'range', 'limit']) {
        q[m] = (...a: unknown[]) => {
          llamadas.push([m, tabla, ...a])
          if (m === 'range') rango = [a[0] as number, a[1] as number]
          if (m === 'limit') limite = a[0] as number
          return q
        }
      }
      q.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => {
        if (o.falloRed) return Promise.reject(new TypeError('Network request failed')).then(ok, ko)
        let data: unknown[]
        if (tabla === 'persona') {
          if (o.errorPersona) return Promise.resolve({ data: null, error: o.errorPersona }).then(ok, ko)
          const desde = rango ? rango[0] : 0
          const hasta = rango ? rango[1] : (limite ?? total) - 1
          data = []
          for (let i = desde; i <= hasta && i < total; i++) {
            data.push({ id: i + 1, nombre: `P${i + 1}`, direccion: null, documento: `D${i + 1}`, documento_tipo: 'DPI', categoria: null })
          }
        } else {
          data = tablas[tabla] ?? []
        }
        return Promise.resolve({ data, error: null }).then(ok, ko)
      }
      return q
    },
  }
  return { cliente: cliente as never, llamadas }
}

const rangosPersona = (llamadas: unknown[][]) =>
  llamadas.filter((c) => c[0] === 'range' && c[1] === 'persona').map((c) => [c[2], c[3]])

function catalogosGuardados(personas: unknown[]): CatalogosCampo {
  return {
    actividades: [],
    horas: [],
    zonas: [],
    geo: { horaDefaultId: null },
    personas: personas as CatalogosCampo['personas'],
  }
}

test('catálogos: clientes por páginas de 500 hasta el tope de campo', async () => {
  const { cliente, llamadas } = clienteFalso({ totalPersonas: 5000 })
  const r = await cargarCatalogosCampo({ clave: CLAVE, cache: cacheMemoria(), cliente })
  assert.equal(r.origen, 'servidor')
  assert.equal(r.personas.length, LIMITE_PERSONAS_CAMPO)
  assert.deepEqual(rangosPersona(llamadas), [[0, 499], [500, 999], [1000, 1499], [1500, 1999]])
  const ordenes = llamadas.filter((c) => c[0] === 'order' && c[1] === 'persona').map((c) => c[2])
  assert.deepEqual(ordenes, ['nombre', 'id', 'nombre', 'id', 'nombre', 'id', 'nombre', 'id'])
  assert.ok(!llamadas.some((c) => c[0] === 'limit' && c[1] === 'persona'))
})

test('catálogos: una página corta de clientes termina la descarga', async () => {
  const { cliente, llamadas } = clienteFalso({ totalPersonas: 620 })
  const r = await cargarCatalogosCampo({ clave: CLAVE, cache: cacheMemoria(), cliente })
  assert.equal(r.personas.length, 620)
  assert.deepEqual(rangosPersona(llamadas), [[0, 499], [500, 999]])
  assert.equal(r.personas[0].documento, 'D1')
})

test('catálogos: el error del servidor al leer clientes se propaga', async () => {
  const fallo = { code: '42501', message: 'permission denied' }
  const { cliente } = clienteFalso({ errorPersona: fallo })
  await assert.rejects(cargarCatalogosCampo({ clave: CLAVE, cache: cacheMemoria(), cliente }), (e) => e === fallo)
})

test('catálogos sin sesión vigente usan la copia guardada sin consultar', async () => {
  const cache = cacheMemoria()
  await cache.guardar(CLAVE, 'catalogos', catalogosGuardados([{ id: 9, nombre: 'Ana', direccion: null }]), new Date('2026-11-13T22:00:00Z'))
  const { cliente, llamadas } = clienteFalso({ session: null })
  const r = await cargarCatalogosCampo({ clave: CLAVE, cache, cliente })
  assert.equal(r.origen, 'cache')
  assert.equal(r.guardadoEn, '2026-11-13T22:00:00.000Z')
  assert.equal(r.personas[0].nombre, 'Ana')
  assert.deepEqual(llamadas, [])
})

test('cartera sin señal sale de los clientes guardados con los catálogos', async () => {
  const cache = cacheMemoria()
  await cache.guardar(
    CLAVE,
    'catalogos',
    catalogosGuardados([
      { id: 9, nombre: 'Ana', direccion: 'Col. Centro', documento: '0801', documento_tipo: 'DNI', categoria: 'comerciante' },
      { id: 10, nombre: 'Beto', direccion: null },
    ]),
    new Date('2026-11-13T22:00:00Z'),
  )
  const { cliente } = clienteFalso({ falloRed: true })
  const r = await cargarCartera({ clave: CLAVE, cache, cliente })
  assert.equal(r.origen, 'cache')
  assert.equal(r.guardadoEn, '2026-11-13T22:00:00.000Z')
  assert.deepEqual(r.datos, [
    { id: 9, nombre: 'Ana', direccion: 'Col. Centro', documento: '0801', documento_tipo: 'DNI', categoria: 'comerciante' },
    { id: 10, nombre: 'Beto', direccion: null, documento: null, documento_tipo: 'DPI', categoria: null },
  ])
})

test('cartera sin sesión vigente usa la copia guardada sin consultar', async () => {
  const cache = cacheMemoria()
  await cache.guardar(CLAVE, 'catalogos', catalogosGuardados([{ id: 9, nombre: 'Ana', direccion: null }]))
  const { cliente, llamadas } = clienteFalso({ session: null })
  const r = await cargarCartera({ clave: CLAVE, cache, cliente })
  assert.equal(r.origen, 'cache')
  assert.deepEqual(llamadas, [])
})

test('cartera en línea consulta el servidor y no pisa los clientes guardados', async () => {
  const cache = cacheMemoria()
  await cache.guardar(CLAVE, 'catalogos', catalogosGuardados([{ id: 9, nombre: 'Ana', direccion: null }]))
  const { cliente, llamadas } = clienteFalso({ totalPersonas: 3 })
  const r = await cargarCartera({ clave: CLAVE, cache, cliente })
  assert.equal(r.origen, 'servidor')
  assert.equal(r.datos.length, 3)
  assert.ok(llamadas.some((c) => c[0] === 'limit' && c[1] === 'persona' && c[2] === 200))
  const g = await cache.leer<CatalogosCampo>(CLAVE, 'catalogos')
  assert.deepEqual(g?.datos.personas, [{ id: 9, nombre: 'Ana', direccion: null }])
})

test('cartera sin señal y sin catálogos guardados lanza GC-NET-002', async () => {
  const { cliente } = clienteFalso({ falloRed: true })
  await assert.rejects(cargarCartera({ clave: CLAVE, cache: cacheMemoria(), cliente }), /^Error: GC-NET-002/)
})
