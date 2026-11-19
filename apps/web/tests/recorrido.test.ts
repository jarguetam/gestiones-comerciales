import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  catalogoRecorrido,
  claveRecorrido,
  debeAutoiniciar,
  escaparHtml,
  marcarRecorridoVisto,
  resolverPasos,
  type ContextoRecorrido,
} from '../src/features/recorrido/recorrido.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const CTX: ContextoRecorrido = {
  empresa: 'Hábitat',
  rol: 'gerente',
  etiquetaVisitas: 'Visitas',
  etiquetaPersonas: 'Personas',
  etiquetaJornada: 'Jornada',
  etiquetaCartera: 'Cartera',
}

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    datos,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  }
}

const almacenRoto = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

test('cada ancla del catálogo existe como data-tour en AppShell', () => {
  const shell = readFileSync(join(root, 'src/app/AppShell.tsx'), 'utf8')
  const navEnShell = ['/', '/visitas', '/personas', '/crm', '/formularios', '/mapa', '/usuarios', '/configuracion']
  for (const to of navEnShell) assert.ok(shell.includes(`to: '${to}'`), `AppShell ya no tiene ${to}`)
  const fijas = new Set(['menu', 'menu-campo', 'campana', 'nueva-visita', 'nueva-visita-fab', 'recorrido', 'campo-mas'])
  for (const paso of catalogoRecorrido(CTX)) {
    for (const { selector } of paso.anclas) {
      const id = /^\[data-tour="([a-z-]+)"\]$/.exec(selector)?.[1]
      assert.ok(id, `selector inesperado ${selector}`)
      if (fijas.has(id)) {
        assert.ok(shell.includes(`data-tour="${id}"`), `falta data-tour="${id}" en AppShell`)
      } else {
        assert.match(id, /^(nav|campo)-/, `ancla sin origen conocido: ${id}`)
      }
    }
  }
  assert.match(shell, /data-tour=\{`nav-\$\{anclaNav\(item\.to\)\}`\}/)
  assert.match(shell, /data-tour=\{`campo-\$\{anclaNav\(item\.to\)\}`\}/)
})

test('el catálogo arranca con bienvenida centrada y termina en repetir', () => {
  const pasos = catalogoRecorrido(CTX)
  assert.equal(pasos[0].id, 'bienvenida')
  assert.deepEqual(pasos[0].anclas, [])
  assert.match(pasos[0].descripcion, /Hábitat/)
  assert.equal(pasos.at(-1)?.id, 'repetir')
  assert.equal(new Set(pasos.map((p) => p.id)).size, pasos.length)
})

test('el tablero menciona el filtro por equipo solo a quien puede usarlo', () => {
  const tablero = (rol: string) => catalogoRecorrido({ ...CTX, rol }).find((p) => p.id === 'tablero')!.descripcion
  assert.match(tablero('gerente'), /equipo/)
  assert.match(tablero('admin'), /equipo/)
  assert.doesNotMatch(tablero('supervisor'), /equipo/)
  assert.doesNotMatch(tablero('asesor'), /equipo/)
})

test('usa el vocabulario del tenant y un nombre por defecto', () => {
  const pasos = catalogoRecorrido({ ...CTX, empresa: '  ', etiquetaVisitas: 'Gestiones', etiquetaPersonas: 'Clientes' })
  assert.equal(pasos.find((p) => p.id === 'visitas')?.titulo, 'Gestiones')
  assert.equal(pasos.find((p) => p.id === 'personas')?.titulo, 'Clientes')
  assert.match(pasos[0].descripcion, /tu empresa/)
})

test('resolverPasos deja solo anclas visibles y prefiere la primera', () => {
  const pasos = catalogoRecorrido(CTX)
  const visibles = new Map([
    ['[data-tour="menu-campo"]', 'barra'],
    ['[data-tour="nav-visitas"]', 'lateral-visitas'],
    ['[data-tour="campo-visitas"]', 'barra-visitas'],
  ])
  const r = resolverPasos(pasos, (s) => visibles.get(s) ?? null)
  assert.deepEqual(
    r.map((x) => [x.id, x.elemento, x.lado]),
    [
      ['bienvenida', undefined, undefined],
      ['menu', 'barra', 'top'],
      ['visitas', 'lateral-visitas', 'right'],
    ],
  )
})

test('en la barra de campo el título usa la etiqueta visible', () => {
  const pasos = catalogoRecorrido(CTX)
  const soloCampo = (s: string) => (s.includes('campo-') ? s : null)
  const r = resolverPasos(pasos, soloCampo)
  const titulo = (id: string) => r.find((x) => x.id === id)?.titulo
  assert.equal(titulo('tablero'), 'Hoy')
  assert.equal(titulo('visitas'), 'Jornada')
  assert.equal(titulo('personas'), 'Cartera')
  assert.equal(titulo('crm'), 'CRM')
  assert.equal(r.find((x) => x.id === 'visitas')?.lado, 'top')
  const escritorio = resolverPasos(pasos, (s) => (s.includes('nav-') ? s : null))
  assert.equal(escritorio.find((x) => x.id === 'visitas')?.titulo, 'Visitas')
})

test('escaparHtml neutraliza marcas en textos del tenant', () => {
  assert.equal(escaparHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;')
})

test('autoinicio solo la primera vez, en el tablero y sin automatización', () => {
  const base = { almacen: almacenFalso(), usuarioId: 'u1', ruta: '/', automatizado: false }
  assert.equal(debeAutoiniciar(base), true)
  assert.equal(debeAutoiniciar({ ...base, ruta: '/visitas' }), false)
  assert.equal(debeAutoiniciar({ ...base, automatizado: true }), false)
  assert.equal(debeAutoiniciar({ ...base, usuarioId: undefined }), false)
  assert.equal(debeAutoiniciar({ ...base, almacen: null }), false)
  assert.equal(debeAutoiniciar({ ...base, almacen: almacenFalso({ [claveRecorrido('u1')]: '1' }) }), false)
  assert.equal(debeAutoiniciar({ ...base, usuarioId: 'u2', almacen: almacenFalso({ [claveRecorrido('u1')]: '1' }) }), true)
})

test('storage bloqueado: no insiste ni rompe', (t) => {
  t.mock.method(console, 'warn', () => {})
  assert.equal(debeAutoiniciar({ almacen: almacenRoto, usuarioId: 'u1', ruta: '/', automatizado: false }), false)
  assert.equal(marcarRecorridoVisto(almacenRoto, 'u1'), false)
})

test('marcarRecorridoVisto guarda por usuario', () => {
  const a = almacenFalso()
  assert.equal(marcarRecorridoVisto(a, 'u1'), true)
  assert.equal(a.datos.get('gc.recorrido.v1:u1'), '1')
  assert.equal(marcarRecorridoVisto(a, undefined), false)
  assert.equal(marcarRecorridoVisto(null, 'u1'), false)
})
