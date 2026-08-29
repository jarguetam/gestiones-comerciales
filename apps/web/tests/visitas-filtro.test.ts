import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  filtrarVisitas,
  paginar,
  parseFiltrosVisita,
  serializarFiltrosVisita,
  PAGE_SIZE_VISITAS,
} from '../src/lib/visitasFiltro.ts'

const ITEMS = [
  { id: '1', date: '2026-09-01', estado: 'programada', asesorId: 'a1', zonaId: 1 },
  { id: '2', date: '2026-09-02', estado: 'completada', asesorId: 'a1', zonaId: 2 },
  { id: '3', date: '2026-09-03', estado: 'aprobada', asesorId: 'a2', zonaId: 1 },
  { id: '4', date: '2026-09-10', estado: 'programada', asesorId: 'a2', zonaId: 2 },
]

test('parse y serializar filtros omiten defaults', () => {
  const f = parseFiltrosVisita(new URLSearchParams('estado=completada&asesor=a1&pagina=2'))
  assert.equal(f.estado, 'completada')
  assert.equal(f.asesor, 'a1')
  assert.equal(f.pagina, 2)
  const q = serializarFiltrosVisita(f).toString()
  assert.match(q, /estado=completada/)
  assert.match(q, /pagina=2/)
  const vacio = serializarFiltrosVisita(parseFiltrosVisita(new URLSearchParams()))
  assert.equal(vacio.toString(), '')
})

test('filtrarVisitas combina estado, asesor, zona y fecha', () => {
  const f = parseFiltrosVisita(new URLSearchParams('estado=programada&zona=1'))
  const r = filtrarVisitas(ITEMS, f)
  assert.equal(r.length, 1)
  assert.equal(r[0].id, '1')
  const rango = filtrarVisitas(ITEMS, parseFiltrosVisita(new URLSearchParams('desde=2026-09-02&hasta=2026-09-03')))
  assert.equal(rango.length, 2)
})

test('paginar corta en PAGE_SIZE y no se pasa de la última página', () => {
  const muchos = Array.from({ length: 23 }, (_, i) => ({ id: String(i), date: '2026-09-01' }))
  const p1 = paginar(muchos, 1)
  assert.equal(p1.slice.length, PAGE_SIZE_VISITAS)
  assert.equal(p1.total, 23)
  assert.equal(p1.paginas, 3)
  const p99 = paginar(muchos, 99)
  assert.equal(p99.slice.length, 3)
})
