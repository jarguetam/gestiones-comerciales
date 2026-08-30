import { strict as assert } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { ejecutarMutacion } from '../../mobile/src/lib/sync.ts'

const workspace = fileURLToPath(new URL('../../../', import.meta.url))
const protectedTables = new Set(['deposito', 'solicitud', 'lead', 'visita'])

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : []
    }),
  )
  return nested.flat()
}

async function parse(path: string): Promise<ts.SourceFile> {
  const source = await readFile(path, 'utf8')
  return ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function calledMethod(node: ts.CallExpression, method: string): boolean {
  return ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === method
}

function literalArgument(node: ts.CallExpression): string | undefined {
  const argument = node.arguments[0]
  return argument && ts.isStringLiteralLike(argument) ? argument.text : undefined
}

function sourceTable(node: ts.Node): string | undefined {
  if (ts.isCallExpression(node)) {
    if (calledMethod(node, 'from')) return literalArgument(node)
    return sourceTable(node.expression)
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return sourceTable(node.expression)
  }
  return undefined
}

function callsIn(source: ts.SourceFile): {
  directUpdates: Array<{ table: string; line: number }>
  rpcs: string[]
} {
  const directUpdates: Array<{ table: string; line: number }> = []
  const rpcs: string[] = []

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      if (calledMethod(node, 'update')) {
        const table = sourceTable(node.expression)
        if (table && protectedTables.has(table)) {
          directUpdates.push({
            table,
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          })
        }
      }
      if (calledMethod(node, 'rpc')) {
        const rpc = literalArgument(node)
        if (rpc) rpcs.push(rpc)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return { directUpdates, rpcs }
}

test('ningún cliente hace UPDATE directo de estados protegidos', async () => {
  const violations: string[] = []
  for (const app of ['web', 'backoffice', 'mobile']) {
    const root = resolve(workspace, 'apps', app, 'src')
    for (const path of await sourceFiles(root)) {
      const source = await parse(path)
      for (const update of callsIn(source).directUpdates) {
        violations.push(`${relative(workspace, path)}:${update.line} actualiza ${update.table}`)
      }
    }
  }
  assert.deepEqual(violations, [])
})

test('los módulos reales llaman las RPC canónicas de transición', async () => {
  const expected = new Map([
    ['apps/web/src/features/depositos/DepositosPage.tsx', 'deposito_confirmar'],
    ['apps/web/src/features/crm/crmApi.ts', 'lead_transicion'],
    ['apps/mobile/src/screens/LeadsScreen.tsx', 'lead_transicion'],
    ['apps/mobile/src/lib/sync.ts', 'visita_completar'],
  ])

  for (const [modulePath, rpc] of expected) {
    const calls = callsIn(await parse(resolve(workspace, modulePath))).rpcs
    assert.ok(calls.includes(rpc), `${modulePath} debe llamar ${rpc}`)
  }
})

test('la mutación móvil de completar visita ejecuta RPC, no PostgREST UPDATE', async () => {
  const calls: Array<{ kind: string; name: string; args: unknown }> = []
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ kind: 'rpc', name, args })
      return { error: null }
    },
    from: (name: string) => ({
      update: () => assert.fail(`UPDATE directo inesperado a ${name}`),
    }),
  }

  await ejecutarMutacion(client as never)({
    id: 'task-7',
    tipo: 'visita_completar',
    payload: {
      visitaId: 71,
      comentario: 'Cierre',
      latitud: 14.63,
      longitud: -90.51,
    },
    estado: 'pendiente',
    intentos: 0,
    maxIntentos: 5,
    clienteKey: 'visita_completar:71',
    creadoEn: '2026-08-30T00:00:00.000Z',
    proximoIntentoEn: 0,
  })

  assert.deepEqual(calls, [
    {
      kind: 'rpc',
      name: 'visita_completar',
      args: {
        p_visita_id: 71,
        p_comentario: 'Cierre',
        p_latitud: 14.63,
        p_longitud: -90.51,
      },
    },
  ])
})
