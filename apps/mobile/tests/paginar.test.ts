import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { leerPaginado, TAM_PAGINA } from '../src/lib/paginar.ts'

/** Fetcher falso: sirve `total` filas numeradas y registra cada rango pedido. */
function fuente(total: number) {
  const rangos: Array<[number, number]> = []
  const pedir = async (desde: number, hasta: number) => {
    rangos.push([desde, hasta])
    const filas: number[] = []
    for (let i = desde; i <= hasta && i < total; i++) filas.push(i)
    return filas
  }
  return { pedir, rangos }
}

test('páginas de 500 como máximo (por debajo de max_rows)', () => {
  assert.equal(TAM_PAGINA, 500)
})

test('se detiene en la primera página corta', async () => {
  const f = fuente(1120)
  const filas = await leerPaginado(f.pedir)
  assert.equal(filas.length, 1120)
  assert.deepEqual(f.rangos, [[0, 499], [500, 999], [1000, 1499]])
  assert.equal(filas[1119], 1119)
})

test('página vacía al inicio devuelve lista vacía con una sola consulta', async () => {
  const f = fuente(0)
  assert.deepEqual(await leerPaginado(f.pedir), [])
  assert.deepEqual(f.rangos, [[0, 499]])
})

test('se detiene en el límite y recorta el último rango', async () => {
  const f = fuente(5000)
  const filas = await leerPaginado(f.pedir, { limite: 1200 })
  assert.equal(filas.length, 1200)
  assert.deepEqual(f.rangos, [[0, 499], [500, 999], [1000, 1199]])
})

test('límite múltiplo exacto de la página no pide una página de más', async () => {
  const f = fuente(5000)
  const filas = await leerPaginado(f.pedir, { limite: 1000 })
  assert.equal(filas.length, 1000)
  assert.deepEqual(f.rangos, [[0, 499], [500, 999]])
})

test('total múltiplo exacto de la página termina con una página vacía', async () => {
  const f = fuente(1000)
  const filas = await leerPaginado(f.pedir)
  assert.equal(filas.length, 1000)
  assert.deepEqual(f.rangos, [[0, 499], [500, 999], [1000, 1499]])
})

test('un error en cualquier página se propaga tal cual', async () => {
  const fallo = { code: 'PGRST103', message: 'Requested range not satisfiable' }
  let n = 0
  await assert.rejects(
    leerPaginado(async (desde, hasta) => {
      if (++n === 2) throw fallo
      return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
    }),
    (e) => e === fallo,
  )
  assert.equal(n, 2)
})
